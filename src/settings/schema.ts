import { DEFAULT_PROPERTY_NAMES, type PropertyNames } from '../core/schema';

export interface InventoryOrganizerSettings {
	/** Configurable because a vault may already use `type` or `container`. */
	propertyNames: PropertyNames;
	/** Ask before moving an item into another inventory's container. */
	warnCrossInventory: boolean;
	/**
	 * Show a button on the `container` property row.
	 *
	 * Off-switchable because it is the one feature built on Obsidian's internal
	 * DOM; if a future release breaks it, the user can silence it without
	 * losing anything the commands do not already provide.
	 */
	showPropertyButton: boolean;
	/**
	 * Bind `cover` / `banner` as the card image in generated Bases views, and
	 * seed the matching empty property on new notes.
	 *
	 * A plugin setting rather than a per-inventory declaration: the inventory
	 * root's own views are written at the moment the root note is created, before
	 * it can declare anything, and adding the binding by hand to every new
	 * container's block afterwards is the tedium this exists to remove.
	 */
	cardImages: boolean;
	/** Paths of recently used containers, most recent first. Ordering only. */
	recentContainers: string[];
}

/** Enough to be useful, short enough that a stale entry is never confusing. */
export const MAX_RECENT_CONTAINERS = 8;

export const DEFAULT_SETTINGS: InventoryOrganizerSettings = {
	propertyNames: { ...DEFAULT_PROPERTY_NAMES },
	warnCrossInventory: true,
	showPropertyButton: true,
	// Off, so a new note carries nothing the user did not ask for. Anyone who
	// wants pictures turns it on once and every note created afterwards has them.
	cardImages: false,
	recentContainers: [],
};
