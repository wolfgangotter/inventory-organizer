import { describe, expect, it } from 'vitest';
import {
	newContainer,
	newInventory,
	newItem,
	type NewContainerOptions,
	type NewInventoryOptions,
	type NewItemOptions,
} from '../src/core/create';
import { DEFAULT_PROPERTY_NAMES } from '../src/core/schema';

const names = DEFAULT_PROPERTY_NAMES;

/** Minimal options, so each test states only what it is actually about. */
function inventoryOptions(over: Partial<NewInventoryOptions> = {}): NewInventoryOptions {
	return { tags: [], itemFolder: null, containerFolder: null, cardImages: false, ...over };
}

function containerOptions(over: Partial<NewContainerOptions> = {}): NewContainerOptions {
	return { inventoryLinktext: 'Inv', tags: [], id: 'x', defaults: {}, cardImages: false, ...over };
}

function itemOptions(over: Partial<NewItemOptions> = {}): NewItemOptions {
	return { ...containerOptions(), containerLinktext: null, ...over };
}

describe('newInventory', () => {
	it('marks the note as an inventory and carries its config', () => {
		const spec = newInventory(
			names,
			inventoryOptions({
				tags: ['bike', 'workshop'],
				itemFolder: 'Inventory',
				containerFolder: 'Inventory',
			}),
		);
		expect(spec.frontmatter).toEqual({
			type: 'inventory',
			default_tags: ['bike', 'workshop'],
			item_folder: 'Inventory',
			container_folder: 'Inventory',
		});
	});

	it('omits folder keys rather than writing null', () => {
		// An absent key reads as "no preference"; an explicit null looks broken.
		const spec = newInventory(names, inventoryOptions());
		expect(spec.frontmatter).not.toHaveProperty('item_folder');
		expect(spec.frontmatter).not.toHaveProperty('container_folder');
	});

	it('never seeds a banner on the root, not even with card images on', () => {
		// Neither shipped view renders the root's own image, so the row would be
		// a property nothing reads. A user who wants a header adds one.
		const spec = newInventory(names, inventoryOptions({ cardImages: true }));
		expect(spec.frontmatter).not.toHaveProperty('banner');
	});

	it('copies the tag list instead of aliasing it', () => {
		const tags = ['bike'];
		const spec = newInventory(names, inventoryOptions({ tags }));
		tags.push('mutated');
		expect(spec.frontmatter.default_tags).toEqual(['bike']);
	});

	it('includes both overview bases', () => {
		const body = newInventory(names, inventoryOptions()).body;
		expect(body).toContain('# Containers');
		expect(body).toContain('# Items');
	});
});

describe('newContainer', () => {
	it('writes type, inventory link, id and tags', () => {
		const spec = newContainer(
			names,
			containerOptions({ inventoryLinktext: 'Bike Workshop', tags: ['bike'], id: 'fixed-id' }),
		);
		expect(spec.frontmatter).toEqual({
			type: 'container',
			inventory: '[[Bike Workshop]]',
			id: 'fixed-id',
			tags: ['bike'],
		});
	});

	it('embeds the contents base', () => {
		const spec = newContainer(names, containerOptions());
		expect(spec.body).toContain('container == this.file.asLink()');
	});

	it('honours renamed properties', () => {
		const spec = newContainer(
			{ ...names, type: 'kind', inventory: 'belongs_to' },
			containerOptions(),
		);
		expect(spec.frontmatter.kind).toBe('container');
		expect(spec.frontmatter.belongs_to).toBe('[[Inv]]');
	});
});

describe('newItem', () => {
	it('writes the container link when placed', () => {
		const spec = newItem(
			names,
			itemOptions({
				inventoryLinktext: 'Bike Workshop',
				containerLinktext: 'Brake & Tire Box',
				tags: ['bike'],
				id: 'fixed-id',
			}),
		);
		expect(spec.frontmatter.container).toBe('[[Brake & Tire Box]]');
		expect(spec.frontmatter.type).toBe('item');
	});

	it('omits the container property entirely when unplaced', () => {
		// A missing key is what validation reads as "unplaced"; an empty string
		// would look like a broken link instead.
		const spec = newItem(names, itemOptions());
		expect(spec.frontmatter).not.toHaveProperty('container');
	});

	it('creates an empty body', () => {
		const spec = newItem(names, itemOptions());
		expect(spec.body).toBe('');
	});
});

describe('unseeded by default', () => {
	/**
	 * The plugin used to seed `quantity: 1`, `restock: false` and an empty
	 * `cover` on every item. That is right for a bin of brake cables and noise
	 * for a film collection - and a seed is written before the inventory's
	 * declaration is read, so there was no way to take one back. Guarding this
	 * because re-adding "just one sensible default" is the easy regression.
	 */
	it('writes nothing on an item beyond the structural properties', () => {
		const spec = newItem(names, itemOptions({ containerLinktext: 'Box' }));
		expect(Object.keys(spec.frontmatter).sort()).toEqual([
			'container',
			'id',
			'inventory',
			'tags',
			'type',
		]);
	});

	it('writes nothing on a container beyond the structural properties', () => {
		const spec = newContainer(names, containerOptions());
		expect(Object.keys(spec.frontmatter).sort()).toEqual(['id', 'inventory', 'tags', 'type']);
	});

	it('generates views that read no property the model does not own', () => {
		const bodies = `${newInventory(names, inventoryOptions()).body}\n${
			newContainer(names, containerOptions()).body
		}`;
		expect(bodies).not.toContain('quantity');
		expect(bodies).not.toContain('restock');
		expect(bodies).not.toContain('cover');
		expect(bodies).not.toContain('banner');
	});
});

describe('card images', () => {
	it('seeds an empty cover on items and an empty banner on containers when on', () => {
		// The views about to be written bind `note.cover` / `note.banner`, so the
		// note gets the row to drop a picture onto rather than an "Add property".
		const item = newItem(names, itemOptions({ cardImages: true }));
		const container = newContainer(names, containerOptions({ cardImages: true }));
		expect(item.frontmatter.cover).toBe('');
		expect(container.frontmatter.banner).toBe('');
	});

	it('writes no image property at all when off', () => {
		expect(newItem(names, itemOptions()).frontmatter).not.toHaveProperty('cover');
		expect(newContainer(names, containerOptions()).frontmatter).not.toHaveProperty('banner');
	});

	it('honours a renamed banner and cover', () => {
		const renamed = { ...names, banner: 'header', cover: 'thumb' };
		const item = newItem(renamed, itemOptions({ cardImages: true }));
		const container = newContainer(renamed, containerOptions({ cardImages: true }));
		expect(item.frontmatter.thumb).toBe('');
		expect(item.frontmatter).not.toHaveProperty('cover');
		expect(container.frontmatter.header).toBe('');
	});
});

describe('declared property defaults', () => {
	it('stamps an inventory declaration onto a new item', () => {
		const spec = newItem(names, itemOptions({ defaults: { condition: 'new', purchased: null } }));
		expect(spec.frontmatter.condition).toBe('new');
		expect(spec.frontmatter.purchased).toBeNull();
	});

	it('stamps a declaration onto a new container', () => {
		const spec = newContainer(names, containerOptions({ defaults: { location: 'shelf' } }));
		expect(spec.frontmatter.location).toBe('shelf');
	});

	it('is how an inventory gets quantity and restock back', () => {
		// The replacement for the removed seeds: booleans survive the read, so
		// `restock` lands as a real checkbox in the property editor.
		const spec = newItem(names, itemOptions({ defaults: { quantity: 1, restock: false } }));
		expect(spec.frontmatter.quantity).toBe(1);
		expect(spec.frontmatter.restock).toBe(false);
	});

	it('lets a declaration replace the seeded image', () => {
		const spec = newItem(
			names,
			itemOptions({ cardImages: true, defaults: { cover: '[[placeholder.png]]' } }),
		);
		expect(spec.frontmatter.cover).toBe('[[placeholder.png]]');
	});

	it('never lets a declaration displace the structural properties', () => {
		const spec = newItem(
			names,
			itemOptions({
				inventoryLinktext: 'Right',
				containerLinktext: 'Box',
				tags: ['bike'],
				id: 'real-id',
				defaults: { type: 'widget', inventory: '[[Wrong]]', container: '[[Wrong]]', id: 'forged' },
			}),
		);
		expect(spec.frontmatter.type).toBe('item');
		expect(spec.frontmatter.inventory).toBe('[[Right]]');
		expect(spec.frontmatter.container).toBe('[[Box]]');
		expect(spec.frontmatter.id).toBe('real-id');
	});

	it('writes the inventory type under a renamed type property', () => {
		// `kindOf` reads the configured name, so a hardcoded `type` here would
		// make every new inventory root unclassifiable in a renamed vault.
		const spec = newInventory({ ...names, type: 'kind' }, inventoryOptions());
		expect(spec.frontmatter.kind).toBe('inventory');
	});
});
