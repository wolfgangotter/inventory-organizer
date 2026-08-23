import { Notice, TFile } from 'obsidian';
import { newContainer, newInventory, newItem } from '../core/create';
import { newId } from '../core/ids';
import { orderByRecent } from '../core/recent';
import type { InventoryNote } from '../core/schema';
import { ChoiceModal, noteChoices, type Choice } from '../ui/choice-modal';
import { NamePromptModal } from '../ui/name-prompt';
import { resolveInventory } from './context';
import type InventoryOrganizerPlugin from '../main';

/** Folder of a note, or null for the vault root. */
function folderOf(path: string): string | null {
	const folder = path.split('/').slice(0, -1).join('/');
	return folder || null;
}

/**
 * A new inventory lands beside the note you were looking at, and adopts that
 * folder for its members. Guessing a location is friendlier than asking for one
 * the user would almost always accept.
 */
export function startCreateInventory(plugin: InventoryOrganizerPlugin, active: TFile | null): void {
	const folder = active ? folderOf(active.path) : null;

	new NamePromptModal(plugin.app, {
		title: 'Create inventory',
		placeholder: 'Bike Workshop',
		onSubmit: (name) => {
			void create(plugin, folder, name, () =>
				newInventory({ tags: [], itemFolder: folder, containerFolder: folder }),
			).then((file) => {
				if (file) {
					new Notice('Inventory created. Add tags to `default_tags` to stamp them on new notes.');
				}
			});
		},
	}).open();
}

export function startCreateContainer(plugin: InventoryOrganizerPlugin, active: TFile | null): void {
	resolveInventory(plugin, active, (inventory) => {
		const config = plugin.index.configFor(inventory.ref.path);
		const folder = config.containerFolder ?? folderOf(inventory.ref.path);

		new NamePromptModal(plugin.app, {
			title: `New container in ${inventory.ref.basename}`,
			placeholder: 'Chain Box',
			onSubmit: (name) => {
				void create(plugin, folder, name, (path) =>
					newContainer(plugin.settings.propertyNames, {
						inventoryLinktext: linktext(plugin, inventory, path),
						tags: config.defaultTags,
						id: newId(),
					}),
				);
			},
		}).open();
	});
}

export function startCreateItem(plugin: InventoryOrganizerPlugin, active: TFile | null): void {
	resolveInventory(plugin, active, (inventory) => {
		const config = plugin.index.configFor(inventory.ref.path);
		const folder = config.itemFolder ?? folderOf(inventory.ref.path);

		// Creating an item while looking at a container means putting it in that
		// container. Asking again would be a question with an obvious answer.
		const activeNote = active ? plugin.index.noteFor(active) : null;
		const fromActive =
			activeNote?.kind === 'container' && activeNote.inventoryPath === inventory.ref.path
				? activeNote
				: null;

		new NamePromptModal(plugin.app, {
			title: fromActive ? `New item in ${fromActive.ref.basename}` : 'Create item',
			placeholder: 'Chain Quick Link',
			onSubmit: (name) => {
				if (fromActive) {
					void createItemIn(plugin, inventory, fromActive, folder, name, config.defaultTags);
					return;
				}
				pickContainer(plugin, inventory, (container) => {
					void createItemIn(plugin, inventory, container, folder, name, config.defaultTags);
				});
			},
		}).open();
	});
}

/**
 * Container picker for item creation, with an explicit "no container" row.
 *
 * Unplaced items are a supported state - validation reports them as a warning,
 * not an error - so the escape hatch is a visible choice rather than an
 * ambiguous Escape keypress.
 */
function pickContainer(
	plugin: InventoryOrganizerPlugin,
	inventory: InventoryNote,
	onChoose: (container: InventoryNote | null) => void,
): void {
	const containers = orderByRecent(
		plugin.index.containers(inventory.ref.path),
		plugin.settings.recentContainers,
	);

	if (containers.length === 0) {
		new Notice('No containers yet; creating the item without one.');
		onChoose(null);
		return;
	}

	const choices: Choice<InventoryNote | null>[] = [
		{ label: 'No container', description: 'Create the item unplaced', value: null },
		...noteChoices(containers),
	];

	new ChoiceModal(plugin.app, choices, onChoose, 'Put the item in…').open();
}

async function createItemIn(
	plugin: InventoryOrganizerPlugin,
	inventory: InventoryNote,
	container: InventoryNote | null,
	folder: string | null,
	name: string,
	tags: string[],
): Promise<void> {
	const file = await create(plugin, folder, name, (path) =>
		newItem(plugin.settings.propertyNames, {
			inventoryLinktext: linktext(plugin, inventory, path),
			containerLinktext: container ? linktext(plugin, container, path) : null,
			tags,
			id: newId(),
		}),
	);
	if (file && container) await plugin.rememberContainer(container.ref.path);
}

/** Link text for `target` as written from `sourcePath`, decided by Obsidian. */
function linktext(plugin: InventoryOrganizerPlugin, target: InventoryNote, sourcePath: string): string {
	const file = plugin.index.fileFor(target);
	// Falls back to the basename only if the note vanished mid-flow; the
	// resulting link is then unresolved, which validation will report.
	return file ? plugin.index.linktextFor(file, sourcePath) : target.ref.basename;
}

async function create(
	plugin: InventoryOrganizerPlugin,
	folder: string | null,
	name: string,
	build: Parameters<typeof plugin.notes.create>[2],
): Promise<TFile | null> {
	try {
		const file = await plugin.notes.create(folder, name, build);
		await plugin.notes.open(file);
		return file;
	} catch (err) {
		console.error('[inventory-organizer] create failed', err);
		new Notice('The note could not be created.');
		return null;
	}
}
