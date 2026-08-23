import { FuzzySuggestModal, Notice, type App, type TFile } from 'obsidian';
import { validateInventory } from '../core/validate';
import type { InventoryNote } from '../core/schema';
import { ReportModal } from '../ui/report-modal';
import type InventoryOrganizerPlugin from '../main';

/**
 * Runs the integrity scan and shows the report.
 *
 * Which inventory to check is inferred rather than asked wherever possible: the
 * active note usually says, and a vault with one inventory has no ambiguity to
 * resolve. Only a genuine choice produces a prompt.
 */
export function startValidate(plugin: InventoryOrganizerPlugin, active: TFile | null): void {
	const inventories = plugin.index.inventories();

	if (inventories.length === 0) {
		new Notice('No inventory found. Create one first.');
		return;
	}

	const fromActive = active ? plugin.index.inventoryOf(plugin.index.noteFor(active)) : null;
	const chosen =
		inventories.find((inventory) => inventory.ref.path === fromActive) ??
		(inventories.length === 1 ? inventories[0] : undefined);

	if (chosen) {
		report(plugin, chosen);
		return;
	}

	new InventorySuggestModal(plugin.app, inventories, (inventory) => {
		report(plugin, inventory);
	}).open();
}

function report(plugin: InventoryOrganizerPlugin, inventory: InventoryNote): void {
	// The whole vault is handed to the scan, not just this inventory's members:
	// classifying a container link's target is what tells a broken link apart
	// from one pointing at the wrong kind of note.
	const findings = validateInventory(plugin.index.all(), inventory.ref.path);
	new ReportModal(plugin.app, inventory.ref.basename, findings).open();
}

class InventorySuggestModal extends FuzzySuggestModal<InventoryNote> {
	constructor(
		app: App,
		private readonly inventories: InventoryNote[],
		private readonly onChoose: (inventory: InventoryNote) => void,
	) {
		super(app);
		this.setPlaceholder('Validate which inventory?');
	}

	getItems(): InventoryNote[] {
		return this.inventories;
	}

	getItemText(inventory: InventoryNote): string {
		return `${inventory.ref.basename} ${inventory.ref.path}`;
	}

	onChooseItem(inventory: InventoryNote): void {
		this.onChoose(inventory);
	}
}
