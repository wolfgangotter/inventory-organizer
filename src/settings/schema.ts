import { DEFAULT_PROPERTY_NAMES, type PropertyNames } from '../core/schema';

export interface InventoryOrganizerSettings {
	/** Configurable because a vault may already use `type` or `container`. */
	propertyNames: PropertyNames;
	/** Ask before moving an item into another inventory's container. */
	warnCrossInventory: boolean;
	/** Paths of recently used containers, most recent first. Ordering only. */
	recentContainers: string[];
}

/** Enough to be useful, short enough that a stale entry is never confusing. */
export const MAX_RECENT_CONTAINERS = 8;

export const DEFAULT_SETTINGS: InventoryOrganizerSettings = {
	propertyNames: { ...DEFAULT_PROPERTY_NAMES },
	warnCrossInventory: true,
	recentContainers: [],
};
