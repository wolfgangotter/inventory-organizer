import { Notice, TFile } from 'obsidian';
import { movePatch, planMove } from '../core/move';
import { orderByRecent } from '../core/recent';
import type { InventoryNote } from '../core/schema';
import { ConfirmModal } from '../ui/confirm-modal';
import { ContainerSuggestModal } from '../ui/container-suggest';
import type InventoryOrganizerPlugin from '../main';

/**
 * The move flow, end to end.
 *
 * A move is one property write. Everything before it is about picking the right
 * destination and refusing the wrong ones; `core/move.ts` owns those decisions
 * so that this file stays a thin sequence of user interactions.
 */
export function startMove(plugin: InventoryOrganizerPlugin, file: TFile): void {
	const item = plugin.index.noteFor(file);

	if (item.kind !== 'item') {
		new Notice('This note is not an inventory item.');
		return;
	}

	const containers = orderByRecent(
		plugin.index.containers(item.inventoryPath).filter((c) => c.ref.path !== item.ref.path),
		plugin.settings.recentContainers,
	);

	if (containers.length === 0) {
		new Notice('No containers found. Create one first.');
		return;
	}

	new ContainerSuggestModal(
		plugin.app,
		containers,
		(target) => {
			void completeMove(plugin, item, target);
		},
		`Move "${item.ref.basename}" to…`,
	).open();
}

async function completeMove(
	plugin: InventoryOrganizerPlugin,
	item: InventoryNote,
	target: InventoryNote,
): Promise<void> {
	const plan = planMove(item, target);

	if (plan.kind === 'refuse' || plan.kind === 'noop') {
		new Notice(plan.message);
		return;
	}

	const blocking = plugin.settings.warnCrossInventory
		? plan.warnings.filter((warning) => warning.code === 'cross-inventory')
		: [];

	if (blocking.length > 0) {
		new ConfirmModal(plugin.app, {
			title: 'Move to another inventory?',
			body: [
				...blocking.map((warning) => warning.message),
				`"${item.ref.basename}" will be moved into "${target.ref.basename}".`,
			],
			confirmText: 'Move anyway',
			onConfirm: () => void writeMove(plugin, item, target),
		}).open();
		return;
	}

	await writeMove(plugin, item, target);
}

async function writeMove(
	plugin: InventoryOrganizerPlugin,
	item: InventoryNote,
	target: InventoryNote,
): Promise<void> {
	const itemFile = plugin.index.fileFor(item);
	const targetFile = plugin.index.fileFor(target);

	// Both notes were resolved before the modal opened; either could have been
	// deleted or renamed while it was up.
	if (!itemFile || !targetFile) {
		new Notice('That note no longer exists.');
		return;
	}

	try {
		const linktext = plugin.index.linktextFor(targetFile, itemFile.path);
		await plugin.frontmatter.apply(itemFile, movePatch(plugin.settings.propertyNames, linktext));
		await plugin.rememberContainer(target.ref.path);
		new Notice(`Moved to ${target.ref.basename}.`);
	} catch (err) {
		console.error('[inventory-organizer] move failed', err);
		new Notice('The item could not be moved. Check the note’s properties for broken YAML.');
	}
}
