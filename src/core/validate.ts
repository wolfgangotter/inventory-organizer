import type { InventoryNote } from './schema';

/**
 * Integrity scan over one inventory.
 *
 * Read-only and pure. It never proposes a fix automatically: the failure modes
 * here (a dangling container, an item in no inventory) all have several
 * plausible repairs, and picking one on the user's behalf is how data gets
 * quietly lost. The report is clickable; the user decides.
 */

export type FindingCode =
	| 'missing-type'
	| 'missing-inventory'
	| 'dangling-inventory'
	| 'missing-container'
	| 'dangling-container'
	| 'container-not-a-container'
	| 'cross-inventory'
	| 'empty-container'
	| 'duplicate-container-name';

export type Severity = 'error' | 'warning' | 'info';

export interface Finding {
	code: FindingCode;
	severity: Severity;
	/** The note the finding is about, so the report can open it. */
	path: string;
	message: string;
}

/** Severity order for sorting a report worst-first. */
const RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

/**
 * @param notes  every note believed to belong to this inventory, plus any note
 *               referenced by one of them, so link targets can be classified.
 * @param inventoryPath  path of the inventory root note being checked.
 */
export function validateInventory(notes: readonly InventoryNote[], inventoryPath: string): Finding[] {
	const findings: Finding[] = [];
	const byPath = new Map(notes.map((note) => [note.ref.path, note]));

	const scoped = notes.filter(
		(note) => note.inventoryPath === inventoryPath || note.ref.path === inventoryPath,
	);

	const containers = scoped.filter((note) => note.kind === 'container');
	const items = scoped.filter((note) => note.kind === 'item');
	const occupied = new Set<string>();

	for (const note of scoped) {
		if (note.ref.path === inventoryPath) continue;

		if (note.kind === null) {
			findings.push({
				code: 'missing-type',
				severity: 'error',
				path: note.ref.path,
				message: 'Note has no `type` property, so it is neither an item nor a container.',
			});
		}
		if (note.inventoryDangling) {
			findings.push({
				code: 'dangling-inventory',
				severity: 'error',
				path: note.ref.path,
				message: 'The `inventory` link does not resolve to a note.',
			});
		} else if (note.inventoryPath === null && note.kind !== null) {
			findings.push({
				code: 'missing-inventory',
				severity: 'warning',
				path: note.ref.path,
				message: 'Note is not assigned to an inventory.',
			});
		}
	}

	for (const item of items) {
		if (item.containerDangling) {
			findings.push({
				code: 'dangling-container',
				severity: 'error',
				path: item.ref.path,
				message: 'The `container` link does not resolve to a note.',
			});
			continue;
		}
		if (item.containerPath === null) {
			findings.push({
				code: 'missing-container',
				severity: 'warning',
				path: item.ref.path,
				message: 'Item is not in any container.',
			});
			continue;
		}

		occupied.add(item.containerPath);
		const target = byPath.get(item.containerPath);

		// An unknown target is not an error: the note may simply be outside the
		// set handed to this function. Only a resolved, wrongly-typed target is.
		if (target && target.kind !== 'container') {
			findings.push({
				code: 'container-not-a-container',
				severity: 'error',
				path: item.ref.path,
				message: 'The `container` link points at a note that is not a container.',
			});
		} else if (target && target.inventoryPath !== null && target.inventoryPath !== inventoryPath) {
			findings.push({
				code: 'cross-inventory',
				severity: 'warning',
				path: item.ref.path,
				message: 'Item sits in a container belonging to a different inventory.',
			});
		}
	}

	for (const container of containers) {
		if (!occupied.has(container.ref.path)) {
			findings.push({
				code: 'empty-container',
				severity: 'info',
				path: container.ref.path,
				message: 'Container holds no items.',
			});
		}
	}

	findings.push(...duplicateContainerNames(containers));

	return findings.sort((a, b) => RANK[a.severity] - RANK[b.severity] || a.path.localeCompare(b.path));
}

/**
 * Two containers with the same basename are legal - links resolve by path - but
 * every grouped Bases view will show two identical headings, which is exactly
 * the kind of ambiguity this model was meant to remove.
 */
function duplicateContainerNames(containers: readonly InventoryNote[]): Finding[] {
	const byName = new Map<string, InventoryNote[]>();
	for (const container of containers) {
		const key = container.ref.basename.toLowerCase();
		const bucket = byName.get(key);
		if (bucket) bucket.push(container);
		else byName.set(key, [container]);
	}

	const findings: Finding[] = [];
	for (const bucket of byName.values()) {
		if (bucket.length < 2) continue;
		for (const container of bucket) {
			findings.push({
				code: 'duplicate-container-name',
				severity: 'warning',
				path: container.ref.path,
				message: `${bucket.length} containers share the name "${container.ref.basename}"; grouped views cannot tell them apart.`,
			});
		}
	}
	return findings;
}
