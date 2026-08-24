import { describe, expect, it } from 'vitest';
import { commonInventory, describeBulkPlan, planBulkMove, plural } from '../src/core/bulk';
import { container, item, note } from './helpers';

const INV = 'Inventory/Bike Workshop.md';
const OTHER = 'Inventory/Household.md';
const BOX = container('Inv/Chain Box.md', { inventoryPath: INV });

const paths = (notes: { ref: { path: string } }[]) => notes.map((n) => n.ref.path);

describe('planBulkMove', () => {
	it('moves every eligible item', () => {
		const plan = planBulkMove(
			[item('Inv/A.md', { inventoryPath: INV }), item('Inv/B.md', { inventoryPath: INV })],
			BOX,
		);
		expect(paths(plan.movable)).toEqual(['Inv/A.md', 'Inv/B.md']);
		expect(plan.skipped).toEqual([]);
		expect(plan.refused).toEqual([]);
	});

	it('skips items already in the destination', () => {
		const plan = planBulkMove(
			[
				item('Inv/A.md', { inventoryPath: INV, containerPath: BOX.ref.path }),
				item('Inv/B.md', { inventoryPath: INV }),
			],
			BOX,
		);
		expect(paths(plan.skipped)).toEqual(['Inv/A.md']);
		expect(paths(plan.movable)).toEqual(['Inv/B.md']);
	});

	it('filters a mixed selection instead of refusing it', () => {
		// Being told "no" because one of several selected notes was a container
		// would be hostile; the caller reports the ignored ones instead.
		const plan = planBulkMove(
			[
				item('Inv/A.md', { inventoryPath: INV }),
				container('Inv/Other Box.md', { inventoryPath: INV }),
				note('Inv/Untyped.md'),
			],
			BOX,
		);
		expect(paths(plan.movable)).toEqual(['Inv/A.md']);
		expect(paths(plan.refused)).toEqual(['Inv/Other Box.md', 'Inv/Untyped.md']);
	});

	it('flags cross-inventory items as a subset of movable', () => {
		const stray = item('House/Thing.md', { inventoryPath: OTHER });
		const plan = planBulkMove([item('Inv/A.md', { inventoryPath: INV }), stray], BOX);
		expect(paths(plan.movable)).toEqual(['Inv/A.md', 'House/Thing.md']);
		expect(paths(plan.crossInventory)).toEqual(['House/Thing.md']);
	});

	it('refuses to put the destination inside itself', () => {
		const plan = planBulkMove([item(BOX.ref.path, { inventoryPath: INV })], BOX);
		expect(paths(plan.refused)).toEqual([BOX.ref.path]);
	});

	it('treats a dangling container as movable, not skipped', () => {
		const plan = planBulkMove(
			[item('Inv/A.md', { inventoryPath: INV, containerDangling: true })],
			BOX,
		);
		expect(paths(plan.movable)).toEqual(['Inv/A.md']);
	});

	it('handles an empty selection', () => {
		const plan = planBulkMove([], BOX);
		expect(plan).toEqual({ movable: [], skipped: [], refused: [], crossInventory: [] });
	});
});

describe('commonInventory', () => {
	it('returns the shared inventory', () => {
		expect(
			commonInventory([item('a.md', { inventoryPath: INV }), item('b.md', { inventoryPath: INV })]),
		).toBe(INV);
	});

	it('returns null when the selection disagrees', () => {
		// No defensible majority rule, so the picker widens to every container.
		expect(
			commonInventory([item('a.md', { inventoryPath: INV }), item('b.md', { inventoryPath: OTHER })]),
		).toBeNull();
	});

	it('returns null when any item has no inventory', () => {
		expect(commonInventory([item('a.md'), item('b.md', { inventoryPath: INV })])).toBeNull();
	});

	it('returns null for an empty selection', () => {
		expect(commonInventory([])).toBeNull();
	});
});

describe('describeBulkPlan', () => {
	const plan = (over: Partial<ReturnType<typeof planBulkMove>>) => ({
		movable: [],
		skipped: [],
		refused: [],
		crossInventory: [],
		...over,
	});

	it('leads with what will happen', () => {
		const lines = describeBulkPlan(plan({ movable: [item('a.md'), item('b.md')] }), 'Chain Box');
		expect(lines[0]).toBe('Move 2 items into "Chain Box".');
	});

	it('reads correctly for a single item', () => {
		const lines = describeBulkPlan(plan({ movable: [item('a.md')] }), 'Chain Box');
		expect(lines[0]).toBe('Move 1 item into "Chain Box".');
	});

	it('agrees the verb with the count', () => {
		expect(describeBulkPlan(plan({ skipped: [item('a.md')] }), 'X')[1]).toContain('1 item is already');
		expect(describeBulkPlan(plan({ skipped: [item('a.md'), item('b.md')] }), 'X')[1]).toContain(
			'2 items are already',
		);
	});

	it('mentions each group only when it is non-empty', () => {
		expect(describeBulkPlan(plan({ movable: [item('a.md')] }), 'X')).toHaveLength(1);
		expect(
			describeBulkPlan(plan({ movable: [item('a.md')], crossInventory: [item('a.md')] }), 'X'),
		).toHaveLength(2);
	});
});

describe('plural', () => {
	it('pluralises', () => {
		expect(plural(1, 'item')).toBe('1 item');
		expect(plural(0, 'item')).toBe('0 items');
		expect(plural(3, 'item')).toBe('3 items');
	});
});
