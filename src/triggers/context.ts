import { Notice, type TFile } from 'obsidian';
import type { InventoryNote } from '../core/schema';
import { ChoiceModal, noteChoices } from '../ui/choice-modal';
import type InventoryOrganizerPlugin from '../main';

/**
 * Works out which inventory a command should act on.
 *
 * Inferred wherever possible rather than asked: the active note usually says,
 * and a vault with one inventory has nothing to disambiguate. A prompt appears
 * only for a genuine choice, so it stays meaningful when it does.
 */
export function resolveInventory(
	plugin: InventoryOrganizerPlugin,
	active: TFile | null,
	onResolved: (inventory: InventoryNote) => void,
): void {
	const inventories = plugin.index.inventories();

	if (inventories.length === 0) {
		new Notice('No inventory found. Create one first.');
		return;
	}

	const fromActive = active ? plugin.index.inventoryOf(plugin.index.noteFor(active)) : null;
	const inferred =
		inventories.find((inventory) => inventory.ref.path === fromActive) ??
		(inventories.length === 1 ? inventories[0] : undefined);

	if (inferred) {
		onResolved(inferred);
		return;
	}

	new ChoiceModal(plugin.app, noteChoices(inventories), onResolved, 'Which inventory?').open();
}
