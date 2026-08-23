import { describe, expect, it } from 'vitest';
import { isBlank, kindOf, readInventoryConfig } from '../src/core/identify';
import { DEFAULT_PROPERTY_NAMES } from '../src/core/schema';

const names = DEFAULT_PROPERTY_NAMES;

describe('kindOf', () => {
	it('reads each kind', () => {
		expect(kindOf({ type: 'item' }, names)).toBe('item');
		expect(kindOf({ type: 'container' }, names)).toBe('container');
		expect(kindOf({ type: 'inventory' }, names)).toBe('inventory');
	});

	it('tolerates casing and padding', () => {
		expect(kindOf({ type: '  Container ' }, names)).toBe('container');
	});

	it('returns null for anything else', () => {
		expect(kindOf({ type: 'widget' }, names)).toBeNull();
		expect(kindOf({}, names)).toBeNull();
		expect(kindOf(undefined, names)).toBeNull();
		expect(kindOf({ type: 42 }, names)).toBeNull();
		expect(kindOf({ type: ['item'] }, names)).toBeNull();
	});

	it('honours a renamed type property', () => {
		expect(kindOf({ kind: 'item' }, { ...names, type: 'kind' })).toBe('item');
	});

	it('does not guess from tags', () => {
		// Structure lives in `type` alone; inferring from tags is what the old
		// scheme did and why structure ended up in three places.
		expect(kindOf({ tags: ['item', 'bike'] }, names)).toBeNull();
	});
});

describe('isBlank', () => {
	it('treats absent, empty and whitespace as blank', () => {
		expect(isBlank(undefined)).toBe(true);
		expect(isBlank(null)).toBe(true);
		expect(isBlank('')).toBe(true);
		expect(isBlank('  ')).toBe(true);
		expect(isBlank([])).toBe(true);
	});

	it('treats real values as present', () => {
		expect(isBlank('[[Box]]')).toBe(false);
		expect(isBlank(0)).toBe(false);
		expect(isBlank(false)).toBe(false);
		expect(isBlank(['a'])).toBe(false);
	});
});

describe('readInventoryConfig', () => {
	it('reads folders and tags', () => {
		expect(
			readInventoryConfig({
				item_folder: 'Inventory/Bike',
				container_folder: 'Inventory/Bike/Boxes',
				default_tags: ['bike', '#workshop'],
			}),
		).toEqual({
			itemFolder: 'Inventory/Bike',
			containerFolder: 'Inventory/Bike/Boxes',
			defaultTags: ['bike', 'workshop'],
		});
	});

	it('defaults to nothing', () => {
		expect(readInventoryConfig(undefined)).toEqual({
			itemFolder: null,
			containerFolder: null,
			defaultTags: [],
		});
	});

	it('refuses to let a folder escape upwards', () => {
		expect(readInventoryConfig({ item_folder: '../../etc' }).itemFolder).toBe('etc');
		expect(readInventoryConfig({ item_folder: '..' }).itemFolder).toBeNull();
		expect(readInventoryConfig({ item_folder: './Inv/./Bike' }).itemFolder).toBe('Inv/Bike');
	});

	it('accepts a single tag as a string', () => {
		expect(readInventoryConfig({ default_tags: 'bike' }).defaultTags).toEqual(['bike']);
	});

	it('de-duplicates tags and drops junk', () => {
		expect(readInventoryConfig({ default_tags: ['bike', 'bike', '', 7, null] }).defaultTags).toEqual([
			'bike',
		]);
	});
});
