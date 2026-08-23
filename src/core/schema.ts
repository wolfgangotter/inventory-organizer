/**
 * The vocabulary of the inventory model.
 *
 * Structure lives in properties, not tags: `type` says what a note is,
 * `inventory` and `container` are wikilinks that Obsidian resolves, renames and
 * backlinks for us. Tags are left entirely to the user (`bike`, `workshop`).
 *
 * Every relational property is a LINK. This is load-bearing and was settled by
 * probe: Bases compares Link values by resolved target, so a link written as
 * `[[Chain Box]]`, `[[Inventory/Chain Box]]` or `[[Inventory/Chain Box|the box]]`
 * all match the same container. See docs/implementation-plan.md P1-P3.
 */

/** What a note is within an inventory. */
export type NoteKind = 'item' | 'container' | 'inventory';

export const NOTE_KINDS: readonly NoteKind[] = ['item', 'container', 'inventory'];

export function isNoteKind(value: unknown): value is NoteKind {
	return typeof value === 'string' && (NOTE_KINDS as readonly string[]).includes(value);
}

/**
 * Property names are configurable because a vault may already use `type` or
 * `container` for something else. Everything downstream reads them from here
 * rather than hard-coding strings.
 */
export interface PropertyNames {
	/** Discriminator: item | container | inventory. */
	type: string;
	/** Link to the inventory root note. */
	inventory: string;
	/** Link to the containing container. Items only. */
	container: string;
	/** Durable external key. Written on creation, never read by this plugin. */
	id: string;
	quantity: string;
	restock: string;
}

export const DEFAULT_PROPERTY_NAMES: PropertyNames = {
	type: 'type',
	inventory: 'inventory',
	container: 'container',
	id: 'id',
	quantity: 'quantity',
	restock: 'restock',
};

/**
 * Per-inventory configuration, read from the inventory root note's own
 * frontmatter rather than from plugin settings, so it travels with the vault
 * and survives sync to another device.
 */
export interface InventoryConfig {
	itemFolder: string | null;
	containerFolder: string | null;
	defaultTags: string[];
}

export const INVENTORY_CONFIG_KEYS = {
	itemFolder: 'item_folder',
	containerFolder: 'container_folder',
	defaultTags: 'default_tags',
} as const;

/** A file, reduced to what the pure core is allowed to know about it. */
export interface NoteRef {
	path: string;
	basename: string;
}

/**
 * A note in the inventory, with every link already resolved to a path by the
 * adapter layer. The core never resolves links itself - that is Obsidian's job,
 * and keeping it out here is what makes all of this unit-testable.
 */
export interface InventoryNote {
	ref: NoteRef;
	kind: NoteKind | null;
	/** Resolved target of the `inventory` link, or null when absent or broken. */
	inventoryPath: string | null;
	/** The `inventory` property held a value that resolved to nothing. */
	inventoryDangling: boolean;
	/** Resolved target of the `container` link. Items only. */
	containerPath: string | null;
	/** The `container` property held a value that resolved to nothing. */
	containerDangling: boolean;
	id: string | null;
}

/** A frontmatter mutation, applied by the adapter via `processFrontMatter`. */
export interface FrontmatterPatch {
	/** Properties to set. A `null` value means "remove this property". */
	set: Record<string, unknown>;
}

export function emptyPatch(): FrontmatterPatch {
	return { set: {} };
}
