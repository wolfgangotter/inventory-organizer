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
	/** Paths of recently used containers, most recent first. Ordering only. */
	recentContainers: string[];
}

/** Enough to be useful, short enough that a stale entry is never confusing. */
export const MAX_RECENT_CONTAINERS = 8;

export const DEFAULT_SETTINGS: InventoryOrganizerSettings = {
	propertyNames: { ...DEFAULT_PROPERTY_NAMES },
	warnCrossInventory: true,
	showPropertyButton: true,
	recentContainers: [],
};
