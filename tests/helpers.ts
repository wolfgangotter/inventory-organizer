import type { InventoryNote, NoteKind } from '../src/core/schema';

/** Builds an InventoryNote with sane defaults so each test states only what it cares about. */
export function note(path: string, overrides: Partial<Omit<InventoryNote, 'ref'>> = {}): InventoryNote {
	const basename = path.split('/').pop()?.replace(/\.md$/, '') ?? path;
	return {
		ref: { path, basename },
		kind: null,
		inventoryPath: null,
		inventoryDangling: false,
		containerPath: null,
		containerDangling: false,
		id: null,
		...overrides,
	};
}

export function item(path: string, overrides: Partial<Omit<InventoryNote, 'ref' | 'kind'>> = {}) {
	return note(path, { kind: 'item' as NoteKind, ...overrides });
}

export function container(path: string, overrides: Partial<Omit<InventoryNote, 'ref' | 'kind'>> = {}) {
	return note(path, { kind: 'container' as NoteKind, ...overrides });
}
