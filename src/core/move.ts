import { linkValue } from './link-format';
import { emptyPatch, type FrontmatterPatch, type InventoryNote, type PropertyNames } from './schema';

/**
 * Deciding whether a move is allowed, before anything is written.
 *
 * Pure by design: the whole point of the plugin is that it edits the user's
 * notes, so the decision to edit is the part that has to be testable without an
 * Obsidian instance anywhere near it.
 */

export type MoveRefusalCode = 'not-an-item' | 'target-not-container' | 'target-is-self';

export type MoveWarningCode = 'cross-inventory' | 'item-missing-inventory' | 'target-missing-inventory';

export interface MoveWarning {
	code: MoveWarningCode;
	message: string;
}

export type MovePlan =
	| { kind: 'refuse'; code: MoveRefusalCode; message: string }
	| { kind: 'noop'; message: string }
	| { kind: 'move'; warnings: MoveWarning[] };

/**
 * Cross-inventory moves warn rather than refuse.
 *
 * Moving a chain tool from the bike inventory into a household box is a
 * legitimate thing to want, and refusing it would send the user back to editing
 * YAML by hand - which is the workflow this plugin exists to replace. The
 * caller decides whether to confirm; the model just says it is unusual.
 */
export function planMove(item: InventoryNote, target: InventoryNote): MovePlan {
	if (item.kind !== 'item') {
		return {
			kind: 'refuse',
			code: 'not-an-item',
			message: 'Only items can be moved into a container.',
		};
	}
	if (target.kind !== 'container') {
		return {
			kind: 'refuse',
			code: 'target-not-container',
			message: 'The destination is not a container.',
		};
	}
	if (target.ref.path === item.ref.path) {
		return { kind: 'refuse', code: 'target-is-self', message: 'A note cannot contain itself.' };
	}
	// A dangling `container` still counts as "somewhere else", so this compares
	// resolved paths only - re-pointing a broken link at its intended container
	// must not be mistaken for a no-op.
	if (item.containerPath !== null && item.containerPath === target.ref.path) {
		return { kind: 'noop', message: 'The item is already in that container.' };
	}

	const warnings: MoveWarning[] = [];
	if (item.inventoryPath === null) {
		warnings.push({
			code: 'item-missing-inventory',
			message: 'This item is not assigned to an inventory.',
		});
	} else if (target.inventoryPath === null) {
		warnings.push({
			code: 'target-missing-inventory',
			message: 'The destination container is not assigned to an inventory.',
		});
	} else if (item.inventoryPath !== target.inventoryPath) {
		warnings.push({
			code: 'cross-inventory',
			message: 'The destination container belongs to a different inventory.',
		});
	}

	return { kind: 'move', warnings };
}

/**
 * The frontmatter change a move makes.
 *
 * `containerLinktext` must come from Obsidian so the stored link matches the
 * vault's link settings. Nothing else is touched - not `id`, not tags, not the
 * body. A move is one property.
 */
export function movePatch(names: PropertyNames, containerLinktext: string): FrontmatterPatch {
	const patch = emptyPatch();
	patch.set[names.container] = linkValue(containerLinktext);
	return patch;
}

/**
 * Removing an item from its container without putting it anywhere.
 *
 * The property is deleted rather than blanked: validation reads a missing key
 * as "unplaced", where an empty value looks like a link that failed to resolve.
 */
export function clearContainerPatch(names: PropertyNames): FrontmatterPatch {
	const patch = emptyPatch();
	patch.set[names.container] = null;
	return patch;
}
