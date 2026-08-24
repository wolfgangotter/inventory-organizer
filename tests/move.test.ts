import { describe, expect, it } from 'vitest';
import { clearContainerPatch, movePatch, planMove } from '../src/core/move';
import { DEFAULT_PROPERTY_NAMES } from '../src/core/schema';
import { container, item, note } from './helpers';

const INV = 'Inventory/Bike Workshop.md';

describe('planMove', () => {
	it('allows a straightforward move', () => {
		const plan = planMove(
			item('Inv/Tube.md', { inventoryPath: INV, containerPath: 'Inv/Chain Box.md' }),
			container('Inv/Brake Box.md', { inventoryPath: INV }),
		);
		expect(plan).toEqual({ kind: 'move', warnings: [] });
	});

	it('allows a move for an item that has no container yet', () => {
		const plan = planMove(
			item('Inv/Tube.md', { inventoryPath: INV }),
			container('Inv/Brake Box.md', { inventoryPath: INV }),
		);
		expect(plan.kind).toBe('move');
	});

	it('refuses to move something that is not an item', () => {
		const plan = planMove(
			container('Inv/Chain Box.md', { inventoryPath: INV }),
			container('Inv/Brake Box.md', { inventoryPath: INV }),
		);
		expect(plan).toMatchObject({ kind: 'refuse', code: 'not-an-item' });
	});

	it('refuses an untyped note as the subject', () => {
		const plan = planMove(note('Inv/Whatever.md'), container('Inv/Brake Box.md'));
		expect(plan).toMatchObject({ kind: 'refuse', code: 'not-an-item' });
	});

	it('refuses a destination that is not a container', () => {
		const plan = planMove(item('Inv/Tube.md'), item('Inv/Other Tube.md'));
		expect(plan).toMatchObject({ kind: 'refuse', code: 'target-not-container' });
	});

	it('refuses to put a note inside itself', () => {
		const self = 'Inv/Weird.md';
		const plan = planMove(item(self), container(self));
		expect(plan).toMatchObject({ kind: 'refuse', code: 'target-is-self' });
	});

	it('reports a no-op when the item is already there', () => {
		const plan = planMove(
			item('Inv/Tube.md', { containerPath: 'Inv/Brake Box.md' }),
			container('Inv/Brake Box.md'),
		);
		expect(plan.kind).toBe('noop');
	});

	it('does not treat a dangling container as a no-op', () => {
		// Re-pointing a broken link at the container it was meant to name is a
		// real change, and the most common repair. It must not be swallowed.
		const plan = planMove(
			item('Inv/Tube.md', { containerDangling: true }),
			container('Inv/Brake Box.md'),
		);
		expect(plan.kind).toBe('move');
	});

	it('warns but allows a cross-inventory move', () => {
		const plan = planMove(
			item('Inv/Tube.md', { inventoryPath: INV }),
			container('House/Drawer.md', { inventoryPath: 'Inventory/Household.md' }),
		);
		expect(plan.kind).toBe('move');
		expect(plan).toMatchObject({ warnings: [{ code: 'cross-inventory' }] });
	});

	it('warns when the item belongs to no inventory', () => {
		const plan = planMove(item('Inv/Tube.md'), container('Inv/Brake Box.md', { inventoryPath: INV }));
		expect(plan).toMatchObject({ kind: 'move', warnings: [{ code: 'item-missing-inventory' }] });
	});

	it('warns when the destination belongs to no inventory', () => {
		const plan = planMove(item('Inv/Tube.md', { inventoryPath: INV }), container('Inv/Brake Box.md'));
		expect(plan).toMatchObject({ kind: 'move', warnings: [{ code: 'target-missing-inventory' }] });
	});

	it('raises exactly one inventory warning', () => {
		const plan = planMove(item('Inv/Tube.md'), container('Inv/Brake Box.md'));
		expect(plan.kind === 'move' && plan.warnings.length).toBe(1);
	});
});

describe('movePatch', () => {
	it('writes the container as a wikilink and touches nothing else', () => {
		const patch = movePatch(DEFAULT_PROPERTY_NAMES, 'Brake & Tire Box');
		expect(patch.set).toEqual({ container: '[[Brake & Tire Box]]' });
	});

	it('honours a renamed container property', () => {
		const patch = movePatch({ ...DEFAULT_PROPERTY_NAMES, container: 'box' }, 'Chain Box');
		expect(patch.set).toEqual({ box: '[[Chain Box]]' });
	});

	it('passes the linktext through verbatim', () => {
		// Obsidian decides the form; this module must not second-guess it.
		const patch = movePatch(DEFAULT_PROPERTY_NAMES, 'Inventory/Bike/Chain Box');
		expect(patch.set.container).toBe('[[Inventory/Bike/Chain Box]]');
	});
});

describe('clearContainerPatch', () => {
	it('deletes the property rather than blanking it', () => {
		// Validation reads a missing key as "unplaced"; an empty value would look
		// like a link that failed to resolve.
		expect(clearContainerPatch(DEFAULT_PROPERTY_NAMES).set).toEqual({ container: null });
	});

	it('honours a renamed container property', () => {
		expect(clearContainerPatch({ ...DEFAULT_PROPERTY_NAMES, container: 'box' }).set).toEqual({
			box: null,
		});
	});
});
