import { Notice, TFile } from 'obsidian';
import { rankFolders } from '../core/folders';
import { folderOf } from '../core/naming';
import { INVENTORY_CONFIG_KEYS, type InventoryNote } from '../core/schema';
import { ChoiceModal, type Choice } from '../ui/choice-modal';
import { resolveInventory } from './context';
import type InventoryOrganizerPlugin from '../main';

/** Which of the two folder settings a command acts on. */
export type FolderKind = 'item' | 'container';

const CONFIG_KEY: Record<FolderKind, string> = {
	item: INVENTORY_CONFIG_KEYS.itemFolder,
	container: INVENTORY_CONFIG_KEYS.containerFolder,
};

/**
 * Every folder in the vault, as plain paths.
 *
 * The vault root is left out because there is no way to say it: an empty
 * `item_folder` reads as "no preference" and falls back to the inventory's own
 * folder, so offering a row that cannot be expressed would be a lie.
 */
export function vaultFolders(plugin: InventoryOrganizerPlugin): string[] {
	return plugin.app.vault.getAllFolders().map((folder) => folder.path);
}

/**
 * Sets `item_folder` or `container_folder` on an inventory, via a picker.
 *
 * The command exists so the feature does not depend on the suggester attached
 * to the property row: that one reads Obsidian's internal markup and can stop
 * working after an update, and this one is the same job through public API.
 */
export function startSetFolder(
	plugin: InventoryOrganizerPlugin,
	active: TFile | null,
	kind: FolderKind,
): void {
	resolveInventory(plugin, active, (inventory) => {
		const home = folderOf(inventory.ref.path);
		const folders = rankFolders(vaultFolders(plugin), '', home, Number.MAX_SAFE_INTEGER);

		const choices: Choice<string | null>[] = [
			{
				label: 'Beside the inventory note',
				description: home ?? 'Vault root',
				// Clearing the key is how "next to the inventory" is expressed, and
				// it keeps following the note if the inventory is ever moved.
				value: null,
			},
			...folders.map((folder) => ({
				label: folder,
				description: folder === home ? 'The inventory’s own folder' : undefined,
				value: folder,
			})),
		];

		const noun = kind === 'item' ? 'items' : 'containers';
		new ChoiceModal(
			plugin.app,
			choices,
			(folder) => {
				void applyFolder(plugin, inventory, kind, folder);
			},
			`Where should new ${noun} go?`,
		).open();
	});
}

/** Writes the chosen folder, or removes the key when the choice was "beside". */
export async function applyFolder(
	plugin: InventoryOrganizerPlugin,
	inventory: InventoryNote,
	kind: FolderKind,
	folder: string | null,
): Promise<void> {
	const file = plugin.index.fileFor(inventory);
	if (!(file instanceof TFile)) {
		new Notice('That inventory note no longer exists.');
		return;
	}

	// Written unconditionally, even when it looks unchanged. `configFor` reads
	// the metadata cache, which lags the file after an edit, so skipping on a
	// match would sometimes skip a write that was needed - and a pick that
	// silently does nothing is a worse bug than a redundant write.
	try {
		// A null value removes the property; see `FrontmatterWriter.apply`.
		await plugin.frontmatter.apply(file, { set: { [CONFIG_KEY[kind]]: folder } });
	} catch (err) {
		console.error('[inventory-organizer] could not set the folder', err);
		new Notice('The folder could not be saved.');
	}
}
