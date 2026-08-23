import { describe, expect, it } from 'vitest';
import { validateInventory, type Finding, type FindingCode } from '../src/core/validate';
import { container, item, note } from './helpers';

const INV = 'Inventory/Bike Workshop.md';
const root = () => note(INV, { kind: 'inventory' });

function codes(findings: Finding[]): FindingCode[] {
	return findings.map((f) => f.code);
}

describe('validateInventory', () => {
	it('reports nothing for a healthy inventory', () => {
		const findings = validateInventory(
			[
				root(),
				container('Inv/Chain Box.md', { inventoryPath: INV }),
				item('Inv/Tube.md', { inventoryPath: INV, containerPath: 'Inv/Chain Box.md' }),
			],
			INV,
		);
		expect(findings).toEqual([]);
	});

	it('flags a dangling container link as an error', () => {
		const findings = validateInventory(
			[root(), item('Inv/Tube.md', { inventoryPath: INV, containerDangling: true })],
			INV,
		);
		expect(codes(findings)).toContain('dangling-container');
		expect(findings[0]?.severity).toBe('error');
	});

	it('does not also report a dangling item as containerless', () => {
		const findings = validateInventory(
			[root(), item('Inv/Tube.md', { inventoryPath: INV, containerDangling: true })],
			INV,
		);
		expect(codes(findings)).not.toContain('missing-container');
	});

	it('flags an item in no container', () => {
		const findings = validateInventory([root(), item('Inv/Tube.md', { inventoryPath: INV })], INV);
		expect(codes(findings)).toContain('missing-container');
	});

	it('flags a note with no type', () => {
		const findings = validateInventory([root(), note('Inv/Mystery.md', { inventoryPath: INV })], INV);
		expect(codes(findings)).toContain('missing-type');
	});

	it('flags a container link pointing at a non-container', () => {
		const findings = validateInventory(
			[
				root(),
				item('Inv/Tube.md', { inventoryPath: INV, containerPath: 'Inv/Other.md' }),
				item('Inv/Other.md', { inventoryPath: INV, containerPath: 'Inv/Box.md' }),
				container('Inv/Box.md', { inventoryPath: INV }),
			],
			INV,
		);
		expect(codes(findings)).toContain('container-not-a-container');
	});

	it('stays quiet about a container target it was not given', () => {
		// The note may simply be outside the scanned set; claiming it is broken
		// would make the report cry wolf.
		const findings = validateInventory(
			[root(), item('Inv/Tube.md', { inventoryPath: INV, containerPath: 'Elsewhere/Box.md' })],
			INV,
		);
		expect(codes(findings)).not.toContain('container-not-a-container');
		expect(codes(findings)).not.toContain('dangling-container');
	});

	it('reports an empty container as information, not a problem', () => {
		const findings = validateInventory([root(), container('Inv/Empty.md', { inventoryPath: INV })], INV);
		expect(codes(findings)).toEqual(['empty-container']);
		expect(findings[0]?.severity).toBe('info');
	});

	it('flags duplicate container names on every duplicate', () => {
		const findings = validateInventory(
			[
				root(),
				container('A/Box.md', { inventoryPath: INV }),
				container('B/Box.md', { inventoryPath: INV }),
				item('Inv/Tube.md', { inventoryPath: INV, containerPath: 'A/Box.md' }),
				item('Inv/Tube 2.md', { inventoryPath: INV, containerPath: 'B/Box.md' }),
			],
			INV,
		);
		expect(codes(findings).filter((c) => c === 'duplicate-container-name')).toHaveLength(2);
	});

	it('compares container names case-insensitively', () => {
		const findings = validateInventory(
			[
				root(),
				container('A/box.md', { inventoryPath: INV }),
				container('B/Box.md', { inventoryPath: INV }),
			],
			INV,
		);
		expect(codes(findings)).toContain('duplicate-container-name');
	});

	it('ignores notes belonging to another inventory', () => {
		const findings = validateInventory(
			[root(), item('Other/Thing.md', { inventoryPath: 'Inventory/Household.md' })],
			INV,
		);
		expect(findings).toEqual([]);
	});

	it('flags a dangling inventory link', () => {
		const findings = validateInventory(
			[root(), item('Inv/Tube.md', { inventoryPath: INV, inventoryDangling: true })],
			INV,
		);
		expect(codes(findings)).toContain('dangling-inventory');
	});

	it('sorts errors before warnings before info', () => {
		const findings = validateInventory(
			[
				root(),
				container('Inv/Empty.md', { inventoryPath: INV }),
				item('Inv/NoContainer.md', { inventoryPath: INV }),
				item('Inv/Broken.md', { inventoryPath: INV, containerDangling: true }),
			],
			INV,
		);
		expect(findings.map((f) => f.severity)).toEqual(['error', 'warning', 'info']);
	});

	it('never reports the inventory root itself', () => {
		const findings = validateInventory([root()], INV);
		expect(findings.every((f) => f.path !== INV)).toBe(true);
	});
});
