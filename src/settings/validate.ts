import {
	DEFAULT_PROPERTY_NAMES,
	propertyNameProblem,
	RESERVED_TAG_KEY,
	type PropertyNames,
} from '../core/schema';
import { DEFAULT_SETTINGS, MAX_RECENT_CONTAINERS, type InventoryOrganizerSettings } from './schema';

/**
 * Coerces whatever is in `data.json` into valid settings.
 *
 * A synced or hand-edited vault can present any shape at all here, and a
 * settings file is never a good enough reason to fail the whole plugin load -
 * so every field falls back to its default rather than throwing.
 */
export function validateSettings(stored: unknown): InventoryOrganizerSettings {
	const raw = isRecord(stored) ? stored : {};
	return {
		propertyNames: validatePropertyNames(raw.propertyNames),
		warnCrossInventory:
			typeof raw.warnCrossInventory === 'boolean'
				? raw.warnCrossInventory
				: DEFAULT_SETTINGS.warnCrossInventory,
		showPropertyButton:
			typeof raw.showPropertyButton === 'boolean'
				? raw.showPropertyButton
				: DEFAULT_SETTINGS.showPropertyButton,
		cardImages: typeof raw.cardImages === 'boolean' ? raw.cardImages : DEFAULT_SETTINGS.cardImages,
		suggestFolders:
			typeof raw.suggestFolders === 'boolean' ? raw.suggestFolders : DEFAULT_SETTINGS.suggestFolders,
		recentContainers: validateRecent(raw.recentContainers),
	};
}

/**
 * Applies the stored property names, refusing any the rest of the plugin could
 * not use.
 *
 * The settings field validates before it persists, so a bad name only reaches
 * here from a hand-edited or downgraded `data.json` - but it has to be caught,
 * because these names are interpolated into the Bases blocks written to disk.
 * A refused name falls back to its default and says so on the console: silently
 * writing views that match nothing is the failure this exists to prevent.
 */
function validatePropertyNames(stored: unknown): PropertyNames {
	const raw = isRecord(stored) ? stored : {};
	const result = { ...DEFAULT_PROPERTY_NAMES };
	for (const key of Object.keys(DEFAULT_PROPERTY_NAMES) as (keyof PropertyNames)[]) {
		const value = raw[key];
		// A non-string name would silently disable the property, which is far
		// more confusing than ignoring the stored value.
		if (typeof value !== 'string') continue;
		const name = value.trim();
		if (name === result[key]) continue;

		const problem = propertyNameProblem(name, takenNames(result, key));
		if (problem) {
			console.warn(`[inventory-organizer] ignoring the stored ${key} property name: ${problem}`);
			continue;
		}
		result[key] = name;
	}
	return result;
}

/** Every name already spoken for, from the point of view of `key`. */
export function takenNames(names: PropertyNames, key: keyof PropertyNames): string[] {
	const others = (Object.keys(names) as (keyof PropertyNames)[])
		.filter((other) => other !== key)
		.map((other) => names[other]);
	// `tags` is written on every created note too, so renaming onto it would
	// have the note's tag list overwrite the property on the next creation.
	return [...others, RESERVED_TAG_KEY];
}

function validateRecent(stored: unknown): string[] {
	if (!Array.isArray(stored)) return [];
	const paths = stored.filter((entry): entry is string => typeof entry === 'string' && !!entry.trim());
	return [...new Set(paths)].slice(0, MAX_RECENT_CONTAINERS);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
