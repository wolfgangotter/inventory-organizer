import type { TFile } from 'obsidian';
import { validateInventory } from '../core/validate';
import type { InventoryNote } from '../core/schema';
import { ReportModal } from '../ui/report-modal';
import { resolveInventory } from './context';
import type InventoryOrganizerPlugin from '../main';

/**
 * Runs the integrity scan and shows the report.
 *
 * Which inventory to check is inferred rather than asked wherever possible: the
 * active note usually says, and a vault with one inventory has no ambiguity to
 * resolve. Only a genuine choice produces a prompt.
 */
export function startValidate(plugin: InventoryOrganizerPlugin, active: TFile | null): void {
	resolveInventory(plugin, active, (inventory) => {
		report(plugin, inventory);
	});
}

function report(plugin: InventoryOrganizerPlugin, inventory: InventoryNote): void {
	// The whole vault is handed to the scan, not just this inventory's members:
	// classifying a container link's target is what tells a broken link apart
	// from one pointing at the wrong kind of note.
	const findings = validateInventory(plugin.index.all(), inventory.ref.path);
	new ReportModal(plugin.app, inventory.ref.basename, findings).open();
}
