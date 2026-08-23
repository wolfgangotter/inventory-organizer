import { MarkdownView } from 'obsidian';
import { startMove } from './move';
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
}
