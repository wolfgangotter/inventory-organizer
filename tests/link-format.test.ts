import { describe, expect, it } from 'vitest';
import { linkValue, parseLinkText } from '../src/core/link-format';

describe('linkValue', () => {
	it('wraps a linktext', () => {
		expect(linkValue('Chain Box')).toBe('[[Chain Box]]');
	});

	it('leaves ampersands and non-ASCII alone', () => {
		expect(linkValue('Brake & Tire Box')).toBe('[[Brake & Tire Box]]');
		expect(linkValue('Gabelkonus')).toBe('[[Gabelkonus]]');
	});
});

describe('parseLinkText', () => {
	it('reads a plain wikilink', () => {
		expect(parseLinkText('[[Chain Box]]')).toBe('Chain Box');
	});

	it('drops an alias', () => {
		expect(parseLinkText('[[Inventory/Chain Box|the box]]')).toBe('Inventory/Chain Box');
	});

	it('reads an embed', () => {
		expect(parseLinkText('![[Chain Box]]')).toBe('Chain Box');
	});

	it('reads a markdown link', () => {
		expect(parseLinkText('[box](Inventory/Chain%20Box.md)')).toBe('Inventory/Chain Box.md');
	});

	it('survives a malformed percent-escape', () => {
		expect(parseLinkText('[box](Inventory/100%.md)')).toBe('Inventory/100%.md');
	});

	it('treats a bare string as a path', () => {
		expect(parseLinkText('Inventory/Chain Box')).toBe('Inventory/Chain Box');
	});

	it('returns null for nothing usable', () => {
		expect(parseLinkText('')).toBeNull();
		expect(parseLinkText('   ')).toBeNull();
		expect(parseLinkText(undefined)).toBeNull();
		expect(parseLinkText(42)).toBeNull();
		expect(parseLinkText(['[[a]]'])).toBeNull();
	});
});
