import { describe, expect, it } from 'vitest';
import { newContainer, newInventory, newItem } from '../src/core/create';
import { DEFAULT_PROPERTY_NAMES } from '../src/core/schema';

const names = DEFAULT_PROPERTY_NAMES;

describe('newInventory', () => {
	it('marks the note as an inventory and carries its config', () => {
		const spec = newInventory({
			tags: ['bike', 'workshop'],
			itemFolder: 'Inventory',
			containerFolder: 'Inventory',
		});
		expect(spec.frontmatter).toEqual({
			type: 'inventory',
			default_tags: ['bike', 'workshop'],
			item_folder: 'Inventory',
			container_folder: 'Inventory',
		});
	});

	it('omits folder keys rather than writing null', () => {
		// An absent key reads as "no preference"; an explicit null looks broken.
		const spec = newInventory({ tags: [], itemFolder: null, containerFolder: null });
		expect(spec.frontmatter).not.toHaveProperty('item_folder');
		expect(spec.frontmatter).not.toHaveProperty('container_folder');
	});

	it('copies the tag list instead of aliasing it', () => {
		const tags = ['bike'];
		const spec = newInventory({ tags, itemFolder: null, containerFolder: null });
		tags.push('mutated');
		expect(spec.frontmatter.default_tags).toEqual(['bike']);
	});

	it('includes both overview bases', () => {
		const body = newInventory({ tags: [], itemFolder: null, containerFolder: null }).body;
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
		});
		expect(spec.frontmatter).toEqual({
			type: 'container',
			inventory: '[[Bike Workshop]]',
			id: 'fixed-id',
			tags: ['bike'],
		});
	});

	it('embeds the contents base', () => {
		const spec = newContainer(names, { inventoryLinktext: 'Inv', tags: [], id: 'x' });
		expect(spec.body).toContain('container == this.file.asLink()');
	});

	it('honours renamed properties', () => {
		const spec = newContainer(
			{ ...names, type: 'kind', inventory: 'belongs_to' },
			{ inventoryLinktext: 'Inv', tags: [], id: 'x' },
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
		});
		expect(spec.frontmatter).not.toHaveProperty('container');
	});

	it('seeds quantity and restock so the views work from the first note', () => {
		const spec = newItem(names, {
			inventoryLinktext: 'Inv',
			containerLinktext: null,
			tags: [],
			id: 'x',
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
		});
		expect(spec.body).toBe('');
	});
});
