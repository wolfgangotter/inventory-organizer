import { readPropertyDefaults } from './property-defaults';
import {
	INVENTORY_CONFIG_KEYS,
	isNoteKind,
	type InventoryConfig,
	type NoteKind,
	type PropertyNames,
} from './schema';

/**
 * Classifying a note from its frontmatter alone.
 *
 * Deliberately strict: a note is an item only if it says `type: item`. Guessing
 * from tags or folders is how the previous scheme ended up with structure
 * spread across three places.
 */
export function kindOf(
	frontmatter: Record<string, unknown> | undefined,
	names: PropertyNames,
): NoteKind | null {
	const raw = frontmatter?.[names.type];
	if (typeof raw !== 'string') return null;
	return isNoteKind(raw.trim().toLowerCase()) ? (raw.trim().toLowerCase() as NoteKind) : null;
}

/** Whether a frontmatter value is meaningfully absent. */
export function isBlank(value: unknown): boolean {
	if (value === null || value === undefined) return true;
	if (typeof value === 'string') return value.trim() === '';
	return Array.isArray(value) && value.length === 0;
}

/**
 * Reads the per-inventory configuration out of an inventory root note.
 *
 * @param names  needed only by the property defaults, which refuse to redeclare
 *               a reserved property under whatever name it is configured with.
 */
export function readInventoryConfig(
	frontmatter: Record<string, unknown> | undefined,
	names: PropertyNames,
): InventoryConfig {
	return {
		itemFolder: readFolder(frontmatter?.[INVENTORY_CONFIG_KEYS.itemFolder]),
		containerFolder: readFolder(frontmatter?.[INVENTORY_CONFIG_KEYS.containerFolder]),
		defaultTags: readTags(frontmatter?.[INVENTORY_CONFIG_KEYS.defaultTags]),
		itemDefaults: readPropertyDefaults(frontmatter?.[INVENTORY_CONFIG_KEYS.itemDefaults], names),
		containerDefaults: readPropertyDefaults(
			frontmatter?.[INVENTORY_CONFIG_KEYS.containerDefaults],
			names,
		),
	};
}

/**
 * Folder values are user-typed and end up in a vault path, so they are
 * constrained here: relative-parent segments are dropped rather than escaped,
 * because there is no legitimate reason for an inventory to write above itself.
 */
function readFolder(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const segments = value
		.split('/')
		.map((part) => part.trim())
		.filter((part) => part !== '' && part !== '.' && part !== '..');
	return segments.length ? segments.join('/') : null;
}

function readTags(value: unknown): string[] {
	const list = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
	const seen = new Set<string>();
	for (const entry of list) {
		if (typeof entry !== 'string') continue;
		// Accept both `bike` and `#bike`; store the bare form Obsidian expects.
		const tag = entry.trim().replace(/^#/, '');
		if (tag) seen.add(tag);
	}
	return [...seen];
}
