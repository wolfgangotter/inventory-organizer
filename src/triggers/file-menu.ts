import { TFile, type Menu, type TAbstractFile } from 'obsidian';
import { plural } from '../core/bulk';
import { itemsIn, startBulkMove } from './bulk-move';
import { startMove } from './move';
import type InventoryOrganizerPlugin from '../main';

/**
 * The file explorer is the only surface that knows about a multi-selection -
 * the command palette has no concept of one - so bulk move lives here rather
 * than as a command.
 */
export function registerFileMenu(plugin: InventoryOrganizerPlugin): void {
	plugin.registerEvent(
		plugin.app.workspace.on('file-menu', (menu, file) => {
			addMoveItem(plugin, menu, [file]);
		}),
	);

	plugin.registerEvent(
		plugin.app.workspace.on('files-menu', (menu, files) => {
			addMoveItem(plugin, menu, files);
		}),
	);
}

function addMoveItem(
	plugin: InventoryOrganizerPlugin,
	menu: Menu,
	selection: readonly TAbstractFile[],
): void {
	const items = itemsIn(plugin, selection);
	// Nothing to offer: keep the menu clean rather than showing an entry that
	// would immediately say no.
	if (items.length === 0) return;

	// Narrowed rather than cast: one directly-selected item takes the
	// single-move flow, which needs no confirmation step.
	const only = selection.length === 1 ? selection[0] : undefined;
	const singleFile = items.length === 1 && only instanceof TFile ? only : null;

	menu.addItem((entry) =>
		entry
			.setTitle(singleFile ? 'Move to container' : `Move ${plural(items.length, 'item')} to container`)
			.setIcon('package')
			.onClick(() => {
				if (singleFile) startMove(plugin, singleFile);
				else startBulkMove(plugin, selection);
			}),
	);
}
