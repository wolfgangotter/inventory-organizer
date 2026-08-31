import { describe, expect, it } from 'vitest';
import { validateSettings } from '../src/settings/validate';
import { DEFAULT_SETTINGS } from '../src/settings/schema';

describe('validateSettings', () => {
	it('returns defaults for nothing at all', () => {
		expect(validateSettings(undefined)).toEqual(DEFAULT_SETTINGS);
		expect(validateSettings(null)).toEqual(DEFAULT_SETTINGS);
	});

	it('returns defaults for junk', () => {
		// A synced or hand-edited data.json can be literally anything.
		expect(validateSettings('nonsense')).toEqual(DEFAULT_SETTINGS);
		expect(validateSettings([1, 2, 3])).toEqual(DEFAULT_SETTINGS);
		expect(validateSettings(42)).toEqual(DEFAULT_SETTINGS);
	});

	it('keeps valid renamed properties', () => {
		const settings = validateSettings({ propertyNames: { container: 'box', type: 'kind' } });
		expect(settings.propertyNames.container).toBe('box');
		expect(settings.propertyNames.type).toBe('kind');
		// Unspecified names keep their defaults.
		expect(settings.propertyNames.inventory).toBe('inventory');
	});

	it('trims a padded property name', () => {
		expect(validateSettings({ propertyNames: { container: '  box  ' } }).propertyNames.container).toBe(
			'box',
		);
	});

	it('ignores a blank or non-string property name', () => {
		// A blank name would silently disable the property, which is far more
		// confusing than falling back.
		expect(validateSettings({ propertyNames: { container: '   ' } }).propertyNames.container).toBe(
			'container',
		);
		expect(validateSettings({ propertyNames: { container: 7 } }).propertyNames.container).toBe(
			'container',
		);
	});

	it('reads the property-button toggle', () => {
		expect(validateSettings({ showPropertyButton: false }).showPropertyButton).toBe(false);
		expect(validateSettings({ showPropertyButton: 'yes' }).showPropertyButton).toBe(true);
	});

	it('reads the cross-inventory toggle', () => {
		expect(validateSettings({ warnCrossInventory: false }).warnCrossInventory).toBe(false);
		expect(validateSettings({ warnCrossInventory: 'no' }).warnCrossInventory).toBe(true);
	});

	it('reads the card-images toggle', () => {
		expect(validateSettings({ cardImages: true }).cardImages).toBe(true);
		// Anything but a boolean falls back to the default, which is off: a
		// corrupted settings file should not start stamping properties on notes.
		expect(validateSettings({ cardImages: 'on' }).cardImages).toBe(false);
		expect(validateSettings({}).cardImages).toBe(false);
	});

	it('cleans the recent list', () => {
		const recent = validateSettings({ recentContainers: ['a', 'a', '', 7, null, 'b'] }).recentContainers;
		expect(recent).toEqual(['a', 'b']);
	});

	it('caps the recent list', () => {
		const stored = Array.from({ length: 40 }, (_, i) => `p${i}.md`);
		expect(validateSettings({ recentContainers: stored }).recentContainers).toHaveLength(8);
	});

	it('never shares the default object', () => {
		// Mutating one load must not poison the defaults for the next.
		const settings = validateSettings(undefined);
		settings.propertyNames.container = 'mutated';
		expect(DEFAULT_SETTINGS.propertyNames.container).toBe('container');
	});
});
