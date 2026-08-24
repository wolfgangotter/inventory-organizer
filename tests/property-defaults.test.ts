import { describe, expect, it } from 'vitest';
import {
	MAX_PROPERTY_DEFAULTS,
	mergeFrontmatter,
	readPropertyDefaults,
} from '../src/core/property-defaults';
import { DEFAULT_PROPERTY_NAMES } from '../src/core/schema';

const names = DEFAULT_PROPERTY_NAMES;

describe('readPropertyDefaults', () => {
	it('reads a plain declaration', () => {
		expect(readPropertyDefaults({ condition: 'new', warranty_months: 24 }, names)).toEqual({
			condition: 'new',
			warranty_months: 24,
		});
	});

	it('reads a key declared with no value as an empty property', () => {
		// `purchased:` in YAML arrives as null - the normal way to declare a
		// property the user means to fill in later.
		expect(readPropertyDefaults({ purchased: null }, names)).toEqual({ purchased: null });
	});

	it('keeps booleans, zero and the empty string', () => {
		// All three are falsy and all three are legitimate declared values.
		expect(readPropertyDefaults({ lent: false, count: 0, note: '' }, names)).toEqual({
			lent: false,
			count: 0,
			note: '',
		});
	});

	it('keeps a flat list of scalars', () => {
		expect(readPropertyDefaults({ sizes: ['s', 'm', 3] }, names)).toEqual({ sizes: ['s', 'm', 3] });
	});

	it('drops non-scalar entries from a list', () => {
		expect(readPropertyDefaults({ sizes: ['s', { nested: 1 }, ['deep']] }, names)).toEqual({
			sizes: ['s'],
		});
	});

	it('drops a list left with nothing usable rather than writing an empty one', () => {
		expect(readPropertyDefaults({ sizes: [{ nested: 1 }] }, names)).toEqual({});
	});

	it('refuses nested objects', () => {
		// They serialise into YAML this plugin never wrote and cannot be fixed
		// from the properties editor.
		expect(readPropertyDefaults({ spec: { weight: 3 } }, names)).toEqual({});
	});

	it('refuses non-finite numbers', () => {
		expect(readPropertyDefaults({ a: NaN, b: Infinity, c: 1 }, names)).toEqual({ c: 1 });
	});

	describe('reserved keys', () => {
		it('refuses the structural properties', () => {
			const defaults = readPropertyDefaults(
				{ type: 'widget', inventory: '[[Elsewhere]]', container: '[[X]]', id: 'forged' },
				names,
			);
			expect(defaults).toEqual({});
		});

		it('follows renamed properties', () => {
			// Renaming `type` to `kind` must protect `kind` and free up `type`.
			const renamed = { ...names, type: 'kind' };
			const defaults = readPropertyDefaults({ kind: 'widget', type: 'anything' }, renamed);
			expect(defaults).toEqual({ type: 'anything' });
		});

		it('still allows the overridable seeds', () => {
			// quantity, restock, banner and cover are user values, not structure.
			expect(
				readPropertyDefaults({ quantity: 0, restock: true, cover: '[[c.png]]' }, names),
			).toEqual({ quantity: 0, restock: true, cover: '[[c.png]]' });
		});
	});

	describe('malformed input', () => {
		it('reads anything that is not a mapping as no declaration', () => {
			expect(readPropertyDefaults(undefined, names)).toEqual({});
			expect(readPropertyDefaults(null, names)).toEqual({});
			expect(readPropertyDefaults('condition', names)).toEqual({});
			expect(readPropertyDefaults(['condition'], names)).toEqual({});
		});

		it('trims keys and drops blank ones', () => {
			expect(readPropertyDefaults({ '  condition  ': 'new', '   ': 'x' }, names)).toEqual({
				condition: 'new',
			});
		});

		it('caps the number of properties', () => {
			const declared: Record<string, unknown> = {};
			for (let i = 0; i < MAX_PROPERTY_DEFAULTS + 10; i++) declared[`p${i}`] = i;
			expect(Object.keys(readPropertyDefaults(declared, names))).toHaveLength(
				MAX_PROPERTY_DEFAULTS,
			);
		});

		it('caps list length and string length', () => {
			const long = 'x'.repeat(600);
			const defaults = readPropertyDefaults(
				{ list: Array.from({ length: 80 }, (_, i) => i), long },
				names,
			);
			expect(defaults.list).toHaveLength(50);
			expect(defaults).not.toHaveProperty('long');
		});
	});
});

describe('mergeFrontmatter', () => {
	it('lets a declaration override a seed', () => {
		const merged = mergeFrontmatter({ quantity: 1 }, { quantity: 0 }, {});
		expect(merged.quantity).toBe(0);
	});

	it('never lets a declaration override a structural property', () => {
		// The second half of the reserved-key guarantee: even if a key slipped
		// past `readPropertyDefaults`, ordering keeps the note classifiable.
		const merged = mergeFrontmatter({}, { type: 'widget' }, { type: 'item' });
		expect(merged.type).toBe('item');
	});

	it('keeps all three layers when they do not collide', () => {
		const merged = mergeFrontmatter({ cover: '' }, { condition: 'new' }, { type: 'item' });
		expect(merged).toEqual({ cover: '', condition: 'new', type: 'item' });
	});
});
