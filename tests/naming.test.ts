import { describe, expect, it } from 'vitest';
import { joinPath, sanitizeFileName, uniquePath } from '../src/core/naming';

describe('sanitizeFileName', () => {
	it('keeps an ordinary title unchanged', () => {
		expect(sanitizeFileName('Brake & Tire Box')).toBe('Brake & Tire Box');
	});

	it('preserves non-ASCII', () => {
		expect(sanitizeFileName('Gabelkonus Aufschlagwerkzeug')).toBe('Gabelkonus Aufschlagwerkzeug');
	});

	it('strips path separators so a title cannot escape its folder', () => {
		expect(sanitizeFileName('../../secrets')).toBe('secrets');
		expect(sanitizeFileName('a/b\\c')).toBe('abc');
	});

	it('refuses a title that is only dots', () => {
		expect(sanitizeFileName('..')).toBeNull();
		expect(sanitizeFileName('.')).toBeNull();
	});

	it('strips characters Obsidian rejects in file names', () => {
		expect(sanitizeFileName('a:b*c?d"e<f>g|h#i^j[k]l')).toBe('abcdefghijkl');
	});

	it('drops control characters', () => {
		// Built from char codes rather than written literally: a raw control
		// byte in a source file survives review and diffing badly.
		const bell = String.fromCharCode(7);
		const nul = String.fromCharCode(0);
		const del = String.fromCharCode(127);
		expect(sanitizeFileName(`Tube${bell} I`)).toBe('Tube I');
		expect(sanitizeFileName(`a${nul}b${del}c`)).toBe('abc');
	});

	it('collapses whitespace', () => {
		expect(sanitizeFileName('  Chain    Box  ')).toBe('Chain Box');
	});

	it('refuses names that survive as empty', () => {
		expect(sanitizeFileName('   ')).toBeNull();
		expect(sanitizeFileName('///')).toBeNull();
	});

	it('refuses Windows device names', () => {
		expect(sanitizeFileName('CON')).toBeNull();
		expect(sanitizeFileName('lpt1')).toBeNull();
	});

	it('truncates absurdly long titles', () => {
		const name = sanitizeFileName('x'.repeat(500));
		expect(name).not.toBeNull();
		expect(name?.length).toBeLessThanOrEqual(180);
	});
});

describe('joinPath', () => {
	it('joins folder and name', () => {
		expect(joinPath('Inventory/Bike', 'Chain Box')).toBe('Inventory/Bike/Chain Box.md');
	});

	it('handles a vault-root note', () => {
		expect(joinPath(null, 'Chain Box')).toBe('Chain Box.md');
		expect(joinPath('', 'Chain Box')).toBe('Chain Box.md');
	});

	it('tolerates stray slashes', () => {
		expect(joinPath('/Inventory/', 'Box')).toBe('Inventory/Box.md');
	});
});

describe('uniquePath', () => {
	it('returns the plain path when free', () => {
		expect(uniquePath('Inv', 'Box', () => false)).toBe('Inv/Box.md');
	});

	it('suffixes until free', () => {
		const taken = new Set(['Inv/Box.md', 'Inv/Box 1.md']);
		expect(uniquePath('Inv', 'Box', (p) => taken.has(p))).toBe('Inv/Box 2.md');
	});

	it('never returns an occupied path', () => {
		const taken = new Set(['Inv/Box.md']);
		const result = uniquePath('Inv', 'Box', (p) => taken.has(p));
		expect(taken.has(result)).toBe(false);
	});
});
