import type { InventoryNote } from './schema';

/**
 * Ordering for the container picker.
 *
 * Pure, and kept out of the trigger layer on purpose: "which container does the
 * user most likely mean" is a decision, and decisions belong where they can be
 * tested without an Obsidian instance.
 */

/** Most recently used first, everything else alphabetically by name. */
export function orderByRecent(
	containers: readonly InventoryNote[],
	recent: readonly string[],
): InventoryNote[] {
	const rank = new Map(recent.map((path, index) => [path, index]));
	return [...containers].sort((a, b) => {
		const ra = rank.get(a.ref.path) ?? Number.MAX_SAFE_INTEGER;
		const rb = rank.get(b.ref.path) ?? Number.MAX_SAFE_INTEGER;
		return ra - rb || a.ref.basename.localeCompare(b.ref.basename);
	});
}

/**
 * The recent list after using `path`.
 *
 * Moves an existing entry to the front rather than duplicating it, so the list
 * stays a set and the cap means what it says.
 */
export function withRecent(recent: readonly string[], path: string, max: number): string[] {
	return [path, ...recent.filter((entry) => entry !== path)].slice(0, Math.max(0, max));
}
