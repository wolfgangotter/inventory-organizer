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
	/** Wide header image, on inventory roots and containers. Bound by the Bases views. */
	banner: string;
	/** Card image, on items. Bound by the Bases views. */
	cover: string;
}

/**
 * The properties the model is built on, which a per-inventory declaration may
 * never redeclare - see `core/property-defaults`. Everything else, including
 * `quantity`, `banner` and `cover`, is an ordinary value the user may seed.
 */
export const RESERVED_PROPERTY_KEYS: readonly (keyof PropertyNames)[] = [
	'type',
	'inventory',
	'container',
	'id',
];

export const DEFAULT_PROPERTY_NAMES: PropertyNames = {
	type: 'type',
	inventory: 'inventory',
	container: 'container',
	id: 'id',
	quantity: 'quantity',
	restock: 'restock',
	banner: 'banner',
	cover: 'cover',
};

/**
 * What a user-declared default property is allowed to hold.
 *
 * Scalars, an explicit blank, and flat lists of scalars - the shapes Obsidian's
 * property editor can render and round-trip. Nested structures are refused by
 * `core/property-defaults`, because a value the properties UI cannot edit is a
 * value the user has no way to fix.
 */
export type PropertyScalar = string | number | boolean | null;
export type PropertyValue = PropertyScalar | PropertyScalar[];

/** Extra properties one inventory stamps onto the notes it creates. */
export type PropertyDefaults = Record<string, PropertyValue>;

/**
 * Per-inventory configuration, read from the inventory root note's own
 * frontmatter rather than from plugin settings, so it travels with the vault
 * and survives sync to another device.
 */
export interface InventoryConfig {
	itemFolder: string | null;
	containerFolder: string | null;
	defaultTags: string[];
	/** Extra frontmatter this inventory stamps onto the items it creates. */
	itemDefaults: PropertyDefaults;
	/** Extra frontmatter this inventory stamps onto the containers it creates. */
	containerDefaults: PropertyDefaults;
}

export const INVENTORY_CONFIG_KEYS = {
	itemFolder: 'item_folder',
	containerFolder: 'container_folder',
	defaultTags: 'default_tags',
	itemDefaults: 'item_defaults',
	containerDefaults: 'container_defaults',
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
