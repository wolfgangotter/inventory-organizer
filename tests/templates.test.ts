import { describe, expect, it } from 'vitest';
import { containerBase, inventoryBody } from '../src/core/templates';
import { DEFAULT_PROPERTY_NAMES } from '../src/core/schema';

const names = DEFAULT_PROPERTY_NAMES;
const plain = { cardImages: false };
const withImages = { cardImages: true };

/**
 * These assertions guard the probe outcome (P1-P3). If someone "simplifies" a
 * filter back to `file.hasLink` or reaches for `asFile()`, the failure should
 * name the reason rather than showing up as items mysteriously appearing in the
 * wrong container weeks later.
 */
describe('generated Bases blocks', () => {
	const all = `${containerBase(names, plain)}\n${inventoryBody(names, plain)}`;

	it('scopes container contents by resolved link equality', () => {
		expect(containerBase(names, plain)).toContain('container == this.file.asLink()');
	});

	it('scopes inventory views by resolved link equality', () => {
		expect(inventoryBody(names, plain)).toContain('inventory == this.file.asLink()');
	});

	it('never uses file.hasLink, which also matches body mentions', () => {
		expect(all).not.toContain('hasLink');
	});

	it('never dereferences with asFile, which costs a lookup per row', () => {
		expect(all).not.toContain('asFile()');
	});

	it('never filters on the inert id property', () => {
		// `id` is a durable external key. The moment a view reads it, we are back
		// to the opaque-uuid problem this model removed.
		expect(all).not.toMatch(/\bid\b\s*==/);
	});

	it('uses the note. prefix so `type` cannot collide with a Bases keyword', () => {
		expect(all).toContain('note.type == "item"');
		expect(all).toContain('note.type == "container"');
	});

	it('groups items by container', () => {
		expect(inventoryBody(names, plain)).toContain('groupBy:');
		expect(inventoryBody(names, plain)).toContain('property: container');
	});

	it('closes every fence it opens', () => {
		expect((all.match(/```/g) ?? []).length % 2).toBe(0);
	});

	it('leaves no blank line where a switched-off option was', () => {
		// The blocks are assembled by dropping lines, and a stray blank inside a
		// YAML mapping is the one way that can go wrong invisibly.
		for (const block of all.match(/```base\n[\s\S]*?\n```/g) ?? []) {
			expect(block).not.toContain('\n\n');
		}
	});
});

describe('property-agnostic views', () => {
	/**
	 * A generated view shows what the plugin knows - which notes belong here -
	 * and nothing else. The earlier version ordered cards by `quantity` and
	 * shipped a "Restock" tab in every container of every vault, which is one
	 * inventory's workflow imposed on all of them.
	 */
	const all = `${containerBase(names, plain)}\n${inventoryBody(names, plain)}`;

	it('reads no property beyond type, inventory and container', () => {
		expect(all).not.toContain('quantity');
		expect(all).not.toContain('restock');
	});

	it('ships no view filtered on a property the plugin does not write', () => {
		expect(all).not.toContain('name: Restock');
	});
});

describe('card images', () => {
	it('binds cover and banner only when switched on', () => {
		expect(containerBase(names, withImages)).toContain('image: note.cover');
		expect(inventoryBody(names, withImages)).toContain('image: note.banner');
		expect(inventoryBody(names, withImages)).toContain('image: note.cover');
	});

	it('omits the binding and its aspect ratio when switched off', () => {
		const all = `${containerBase(names, plain)}\n${inventoryBody(names, plain)}`;
		expect(all).not.toContain('image:');
		expect(all).not.toContain('imageAspectRatio');
	});
});

describe('configured property names', () => {
	/**
	 * The blocks used to hardcode `container`, `inventory` and `note.type`. In a
	 * vault that renamed one of them, every generated view silently matched
	 * nothing - a Base showing zero rows looks like an empty inventory, not a
	 * bug, which is why this is worth a test rather than a comment.
	 */
	const renamed = {
		...names,
		type: 'kind',
		inventory: 'belongs_to',
		container: 'box',
		cover: 'thumb',
		banner: 'header',
	};

	it('filters on the renamed type and link properties', () => {
		const all = `${containerBase(renamed, plain)}\n${inventoryBody(renamed, plain)}`;
		expect(all).toContain('note.kind == "item"');
		expect(all).toContain('note.kind == "container"');
		expect(all).toContain('belongs_to == this.file.asLink()');
		expect(all).toContain('box == this.file.asLink()');
		expect(all).not.toContain('note.type');
	});

	it('groups by the renamed container property', () => {
		expect(inventoryBody(renamed, plain)).toContain('property: box');
	});

	it('binds the renamed image properties', () => {
		expect(containerBase(renamed, withImages)).toContain('image: note.thumb');
		expect(inventoryBody(renamed, withImages)).toContain('image: note.header');
	});
});
