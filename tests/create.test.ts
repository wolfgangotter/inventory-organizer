import { describe, expect, it } from 'vitest';
import { newContainer, newInventory, newItem } from '../src/core/create';
import { DEFAULT_PROPERTY_NAMES } from '../src/core/schema';

const names = DEFAULT_PROPERTY_NAMES;

describe('newInventory', () => {
	it('marks the note as an inventory and carries its config', () => {
		const spec = newInventory(names, {
			tags: ['bike', 'workshop'],
			itemFolder: 'Inventory',
			containerFolder: 'Inventory',
		});
		expect(spec.frontmatter).toEqual({
			type: 'inventory',
			banner: '',
			default_tags: ['bike', 'workshop'],
			item_folder: 'Inventory',
			container_folder: 'Inventory',
		});
	});

	it('omits folder keys rather than writing null', () => {
		// An absent key reads as "no preference"; an explicit null looks broken.
		const spec = newInventory(names, { tags: [], itemFolder: null, containerFolder: null });
		expect(spec.frontmatter).not.toHaveProperty('item_folder');
		expect(spec.frontmatter).not.toHaveProperty('container_folder');
	});

	it('copies the tag list instead of aliasing it', () => {
		const tags = ['bike'];
		const spec = newInventory(names, { tags, itemFolder: null, containerFolder: null });
		tags.push('mutated');
		expect(spec.frontmatter.default_tags).toEqual(['bike']);
	});

	it('includes both overview bases', () => {
		const body = newInventory(names, { tags: [], itemFolder: null, containerFolder: null }).body;
		expect(body).toContain('# Containers');
		expect(body).toContain('# Items');
	});
});

describe('newContainer', () => {
	it('writes type, inventory link, id and tags', () => {
		const spec = newContainer(names, {
			inventoryLinktext: 'Bike Workshop',
			tags: ['bike'],
			id: 'fixed-id',
			defaults: {},
		});
		expect(spec.frontmatter).toEqual({
			type: 'container',
			inventory: '[[Bike Workshop]]',
			banner: '',
			id: 'fixed-id',
			tags: ['bike'],
		});
	});

	it('embeds the contents base', () => {
		const spec = newContainer(names, { inventoryLinktext: 'Inv', tags: [], id: 'x', defaults: {} });
		expect(spec.body).toContain('container == this.file.asLink()');
	});

	it('honours renamed properties', () => {
		const spec = newContainer(
			{ ...names, type: 'kind', inventory: 'belongs_to' },
			{ inventoryLinktext: 'Inv', tags: [], id: 'x', defaults: {} },
		);
		expect(spec.frontmatter.kind).toBe('container');
		expect(spec.frontmatter.belongs_to).toBe('[[Inv]]');
	});
});

describe('newItem', () => {
	it('writes the container link when placed', () => {
		const spec = newItem(names, {
			inventoryLinktext: 'Bike Workshop',
			containerLinktext: 'Brake & Tire Box',
			tags: ['bike'],
			id: 'fixed-id',
			defaults: {},
		});
		expect(spec.frontmatter.container).toBe('[[Brake & Tire Box]]');
		expect(spec.frontmatter.type).toBe('item');
	});

	it('omits the container property entirely when unplaced', () => {
		// A missing key is what validation reads as "unplaced"; an empty string
		// would look like a broken link instead.
		const spec = newItem(names, {
			inventoryLinktext: 'Inv',
			containerLinktext: null,
			tags: [],
			id: 'x',
			defaults: {},
		});
		expect(spec.frontmatter).not.toHaveProperty('container');
	});

	it('seeds quantity and restock so the views work from the first note', () => {
		const spec = newItem(names, {
			inventoryLinktext: 'Inv',
			containerLinktext: null,
			tags: [],
			id: 'x',
			defaults: {},
		});
		expect(spec.frontmatter.quantity).toBe(1);
		expect(spec.frontmatter.restock).toBe(false);
	});

	it('creates an empty body', () => {
		const spec = newItem(names, {
			inventoryLinktext: 'Inv',
			containerLinktext: null,
			tags: [],
			id: 'x',
			defaults: {},
		});
		expect(spec.body).toBe('');
	});
});

describe('declared property defaults', () => {
	it('stamps an inventory declaration onto a new item', () => {
		const spec = newItem(names, {
			inventoryLinktext: 'Inv',
			containerLinktext: null,
			tags: [],
			id: 'x',
			defaults: { condition: 'new', purchased: null },
		});
		expect(spec.frontmatter.condition).toBe('new');
		expect(spec.frontmatter.purchased).toBeNull();
	});

	it('stamps a declaration onto a new container', () => {
		const spec = newContainer(names, {
			inventoryLinktext: 'Inv',
			tags: [],
			id: 'x',
			defaults: { location: 'shelf' },
		});
		expect(spec.frontmatter.location).toBe('shelf');
	});

	it('seeds an empty cover on items and an empty banner on containers', () => {
		// The shipped Bases views bind `note.cover` and `note.banner`; without
		// the key the row never appears in the property editor to drop an
		// image on, and the card views stay blank forever.
		const item = newItem(names, {
			inventoryLinktext: 'Inv',
			containerLinktext: null,
			tags: [],
			id: 'x',
			defaults: {},
		});
		const container = newContainer(names, {
			inventoryLinktext: 'Inv',
			tags: [],
			id: 'x',
			defaults: {},
		});
		expect(item.frontmatter.cover).toBe('');
		expect(container.frontmatter.banner).toBe('');
	});

	it('lets a declaration replace a seeded value', () => {
		const spec = newItem(names, {
			inventoryLinktext: 'Inv',
			containerLinktext: null,
			tags: [],
			id: 'x',
			defaults: { quantity: 0, cover: '[[placeholder.png]]' },
		});
		expect(spec.frontmatter.quantity).toBe(0);
		expect(spec.frontmatter.cover).toBe('[[placeholder.png]]');
	});

	it('never lets a declaration displace the structural properties', () => {
		const spec = newItem(names, {
			inventoryLinktext: 'Right',
			containerLinktext: 'Box',
			tags: ['bike'],
			id: 'real-id',
			defaults: { type: 'widget', inventory: '[[Wrong]]', container: '[[Wrong]]', id: 'forged' },
		});
		expect(spec.frontmatter.type).toBe('item');
		expect(spec.frontmatter.inventory).toBe('[[Right]]');
		expect(spec.frontmatter.container).toBe('[[Box]]');
		expect(spec.frontmatter.id).toBe('real-id');
	});

	it('honours a renamed banner and cover', () => {
		const renamed = { ...names, banner: 'header', cover: 'thumb' };
		const inventory = newInventory(renamed, {
			tags: [],
			itemFolder: null,
			containerFolder: null,
		});
		const item = newItem(renamed, {
			inventoryLinktext: 'Inv',
			containerLinktext: null,
			tags: [],
			id: 'x',
			defaults: {},
		});
		expect(inventory.frontmatter.header).toBe('');
		expect(inventory.frontmatter).not.toHaveProperty('banner');
		expect(item.frontmatter.thumb).toBe('');
	});

	it('writes the inventory type under a renamed type property', () => {
		// `kindOf` reads the configured name, so a hardcoded `type` here would
		// make every new inventory root unclassifiable in a renamed vault.
		const spec = newInventory(
			{ ...names, type: 'kind' },
			{ tags: [], itemFolder: null, containerFolder: null },
		);
		expect(spec.frontmatter.kind).toBe('inventory');
	});
});
