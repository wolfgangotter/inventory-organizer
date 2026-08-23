import { describe, expect, it } from 'vitest';
import { containerBase, inventoryBody } from '../src/core/templates';

/**
 * These assertions guard the probe outcome (P1-P3). If someone "simplifies" a
 * filter back to `file.hasLink` or reaches for `asFile()`, the failure should
 * name the reason rather than showing up as items mysteriously appearing in the
 * wrong container weeks later.
 */
describe('generated Bases blocks', () => {
	const all = `${containerBase()}\n${inventoryBody()}`;

	it('scopes container contents by resolved link equality', () => {
		expect(containerBase()).toContain('container == this.file.asLink()');
	});

	it('scopes inventory views by resolved link equality', () => {
		expect(inventoryBody()).toContain('inventory == this.file.asLink()');
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
		expect(inventoryBody()).toContain('groupBy:');
		expect(inventoryBody()).toContain('property: container');
	});

	it('closes every fence it opens', () => {
		expect((all.match(/```/g) ?? []).length % 2).toBe(0);
	});
});
