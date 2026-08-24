import { MarkdownView } from 'obsidian';
import { undoLastBulkMove } from './bulk-move';
import { startCreateContainer, startCreateInventory, startCreateItem } from './create';
import { startMove } from './move';
import { startValidate } from './validate';
import type InventoryOrganizerPlugin from '../main';

/**
 * Commands are the primary surface, deliberately.
 *
 * They work with the properties editor hidden, on mobile, and from the mobile
 * toolbar (which can host any registered command). Anything attached to a
 * property row is a convenience layered on top, never the only way in.
 */
export function registerCommands(plugin: InventoryOrganizerPlugin): void {
	plugin.addCommand({
		id: 'move-item-to-container',
		name: 'Move item to container',
		checkCallback: (checking: boolean) => {
			const file = plugin.app.workspace.getActiveViewOfType(MarkdownView)?.file;
			if (!file) return false;

			// Only offer the command on an actual item, so the palette does not
			// advertise an action that would immediately refuse.
			if (plugin.index.noteFor(file).kind !== 'item') return false;
			if (!checking) startMove(plugin, file);
			return true;
		},
	});

	plugin.addCommand({
		id: 'validate-inventory',
		name: 'Validate inventory',
		callback: () => {
			// Not gated on the active note: a vault-wide integrity check is
			// exactly the thing you want to reach when you do not know which
			// note is wrong.
			startValidate(plugin, plugin.app.workspace.getActiveViewOfType(MarkdownView)?.file ?? null);
		},
	});

	// Creation commands infer the inventory and, where obvious, the container -
	// so the common case is a name and nothing else.
	const activeFile = () => plugin.app.workspace.getActiveViewOfType(MarkdownView)?.file ?? null;

	plugin.addCommand({
		id: 'create-inventory',
		name: 'Create inventory',
		callback: () => {
			startCreateInventory(plugin, activeFile());
		},
	});

	plugin.addCommand({
		id: 'create-container',
		name: 'Create container',
		callback: () => {
			startCreateContainer(plugin, activeFile());
		},
	});

	plugin.addCommand({
		id: 'create-item',
		name: 'Create item',
		callback: () => {
			startCreateItem(plugin, activeFile());
		},
	});

	plugin.addCommand({
		id: 'undo-last-bulk-move',
		name: 'Undo last bulk move',
		checkCallback: (checking: boolean) => {
			// Hidden rather than shown-and-refusing, so the palette never offers
			// an undo that would do nothing.
			if (!plugin.lastBulkMove) return false;
			if (!checking) void undoLastBulkMove(plugin);
			return true;
		},
	});
}
