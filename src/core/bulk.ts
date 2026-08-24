import { planMove } from './move';
import type { InventoryNote } from './schema';

/**
 * Partitioning a multi-note selection before anything is written.
 *
 * Every decision here defers to `planMove`, so bulk can never drift from what a
 * single move would have done. What bulk adds is the grouping - and the rule
 * that a mixed selection filters rather than refuses: being told "no" because
 * one of eleven selected notes was a container would be hostile.
 */

export interface BulkPlan {
	/** Items that will actually be written. */
	movable: InventoryNote[];
	/** Already in the destination; writing them would be a no-op. */
	skipped: InventoryNote[];
	/** Not an item, or the destination is the note itself. */
	refused: InventoryNote[];
	/** Subset of `movable` belonging to a different inventory. */
	crossInventory: InventoryNote[];
}

export function planBulkMove(candidates: readonly InventoryNote[], target: InventoryNote): BulkPlan {
	const plan: BulkPlan = { movable: [], skipped: [], refused: [], crossInventory: [] };

	for (const candidate of candidates) {
		const single = planMove(candidate, target);
		if (single.kind === 'refuse') {
			plan.refused.push(candidate);
			continue;
		}
		if (single.kind === 'noop') {
			plan.skipped.push(candidate);
			continue;
		}

		plan.movable.push(candidate);
		if (single.warnings.some((warning) => warning.code === 'cross-inventory')) {
			plan.crossInventory.push(candidate);
		}
	}

	return plan;
}

/**
 * The inventory a selection agrees on, or null when it does not.
 *
 * Used to scope the container picker. There is no defensible majority rule for
 * a mixed selection, so a disagreement widens the picker to every container
 * rather than silently preferring one inventory.
 */
export function commonInventory(items: readonly InventoryNote[]): string | null {
	const first = items[0];
	if (!first || first.inventoryPath === null) return null;
	return items.every((item) => item.inventoryPath === first.inventoryPath)
		? first.inventoryPath
		: null;
}

/**
 * The confirmation text.
 *
 * Pure so the counts can be tested; a bulk move is the least reversible thing
 * this plugin does, and the dialog is the only place the user can catch a
 * selection mistake before it lands.
 */
export function describeBulkPlan(plan: BulkPlan, targetName: string): string[] {
	const lines = [`Move ${plural(plan.movable.length, 'item')} into "${targetName}".`];

	if (plan.skipped.length > 0) {
		const n = plan.skipped.length;
		lines.push(`${plural(n, 'item')} ${isAre(n)} already there and will be skipped.`);
	}
	if (plan.refused.length > 0) {
		const n = plan.refused.length;
		lines.push(`${plural(n, 'selected note')} ${isAre(n)} not an item and will be ignored.`);
	}
	if (plan.crossInventory.length > 0) {
		const n = plan.crossInventory.length;
		lines.push(`${plural(n, 'item')} ${isAre(n)} from a different inventory.`);
	}

	return lines;
}

export function plural(n: number, noun: string): string {
	return n === 1 ? `1 ${noun}` : `${n} ${noun}s`;
}

function isAre(n: number): string {
	return n === 1 ? 'is' : 'are';
}
