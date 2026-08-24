import { DEFAULT_PROPERTY_NAMES, type PropertyNames } from '../core/schema';
import {
	DEFAULT_SETTINGS,
	MAX_RECENT_CONTAINERS,
	type InventoryOrganizerSettings,
} from './schema';

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
		warnCrossInventory: typeof raw.warnCrossInventory === 'boolean'
			? raw.warnCrossInventory
			: DEFAULT_SETTINGS.warnCrossInventory,
		showPropertyButton:
			typeof raw.showPropertyButton === 'boolean'
				? raw.showPropertyButton
				: DEFAULT_SETTINGS.showPropertyButton,
		recentContainers: validateRecent(raw.recentContainers),
	};
}

function validatePropertyNames(stored: unknown): PropertyNames {
	const raw = isRecord(stored) ? stored : {};
	const result = { ...DEFAULT_PROPERTY_NAMES };
	for (const key of Object.keys(DEFAULT_PROPERTY_NAMES) as (keyof PropertyNames)[]) {
		const value = raw[key];
		// A blank or non-string name would silently disable the property, which
		// is far more confusing than ignoring the stored value.
		if (typeof value === 'string' && value.trim()) result[key] = value.trim();
	}
	return result;
}

function validateRecent(stored: unknown): string[] {
	if (!Array.isArray(stored)) return [];
	const paths = stored.filter((entry): entry is string => typeof entry === 'string' && !!entry.trim());
	return [...new Set(paths)].slice(0, MAX_RECENT_CONTAINERS);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
