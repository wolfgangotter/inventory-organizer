import {
	RESERVED_PROPERTY_KEYS,
	type PropertyDefaults,
	type PropertyNames,
	type PropertyScalar,
	type PropertyValue,
} from './schema';

/**
 * User-declared extra frontmatter, read from the inventory root note.
 *
 * The point of this module is that adding a field to your notes should not
 * require a plugin release. An inventory declares what its items and containers
 * carry, and every note it creates is stamped with it:
 *
 * ```yaml
 * type: inventory
 * item_defaults:
 *   condition: new
 *   purchased:
 * container_defaults:
 *   location: shelf
 * ```
 *
 * There is no management UI on purpose. The inventory root note is edited in
 * Obsidian's own property editor, the declaration travels with the vault like
 * the rest of `InventoryConfig`, and it is per-inventory - a bike workshop and
 * a pantry want different fields, which one global list cannot express.
 *
 * Everything here is defensive: the input is hand-edited YAML from a synced
 * vault, so a malformed declaration degrades to fewer properties and never
 * fails note creation.
 */

/**
 * Enough for any realistic inventory, low enough that a corrupted note cannot
 * stamp a thousand properties onto every item created afterwards.
 */
export const MAX_PROPERTY_DEFAULTS = 20;

/** Entries in a list value, capped for the same reason as the key count. */
const MAX_LIST_ENTRIES = 50;

/** Length cap on a single string value, to keep a runaway paste out of the note. */
const MAX_STRING_LENGTH = 512;

function isScalar(value: unknown): value is PropertyScalar {
	return (
		value === null ||
		typeof value === 'boolean' ||
		// NaN and Infinity have no YAML round-trip worth relying on.
		(typeof value === 'number' && Number.isFinite(value)) ||
		(typeof value === 'string' && value.length <= MAX_STRING_LENGTH)
	);
}

function readValue(value: unknown): PropertyValue | undefined {
	// `undefined` reaches here from a key written with no value at all
	// (`purchased:`), which is the normal way to declare an empty property.
	if (value === undefined) return null;
	if (isScalar(value)) return value;
	if (Array.isArray(value)) {
		const entries = value.filter(isScalar).slice(0, MAX_LIST_ENTRIES);
		// A list that held nothing usable is dropped rather than written as `[]`,
		// which would look like a deliberate empty list the user chose.
		return entries.length ? entries : undefined;
	}
	return undefined;
}

/**
 * Reads one `*_defaults` block into a checked record.
 *
 * Reserved keys are refused: `type`, `inventory`, `container` and `id` are what
 * the whole model is built on, and letting a note redeclare them would break
 * classification and linking in a way no error message could explain. Note that
 * the reserved set follows the *configured* property names, so renaming `type`
 * to `kind` protects `kind` instead.
 */
export function readPropertyDefaults(value: unknown, names: PropertyNames): PropertyDefaults {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};

	const reserved = new Set(RESERVED_PROPERTY_KEYS.map((key) => names[key]));
	const defaults: PropertyDefaults = {};

	for (const [rawKey, rawValue] of Object.entries(value)) {
		if (Object.keys(defaults).length >= MAX_PROPERTY_DEFAULTS) break;

		const key = rawKey.trim();
		if (!key || reserved.has(key)) continue;

		const checked = readValue(rawValue);
		if (checked !== undefined) defaults[key] = checked;
	}

	return defaults;
}

/**
 * Assembles the frontmatter of a new note from its three layers.
 *
 * The order is the whole contract:
 *
 *   1. `seeds` - starting values this plugin offers, like the empty `cover` row
 *      or `quantity: 1`. They exist so the Bases views have something to bind
 *      and the property shows up in the editor at all. They are suggestions.
 *   2. `defaults` - what the inventory declared. It overrides the seeds, which
 *      is the point: an inventory that wants every item to start at
 *      `quantity: 0`, or with a placeholder cover, says so and is obeyed.
 *   3. `structural` - `type`, the links, the id, the tags. Computed here and
 *      applied last, so nothing a note declares can displace the properties
 *      that make it classifiable and findable.
 *
 * `readPropertyDefaults` already refuses the reserved keys; this ordering is
 * the second half of that guarantee, and it holds even if the two ever drift.
 */
export function mergeFrontmatter(
	seeds: Record<string, unknown>,
	defaults: PropertyDefaults,
	structural: Record<string, unknown>,
): Record<string, unknown> {
	return { ...seeds, ...defaults, ...structural };
}
