/**
 * @vitest-environment jsdom
 *
 * Expanding a file-explorer selection. Needs the real TFile/TFolder shapes, so
 * it runs against the stub rather than plain objects.
 */
import { describe, expect, it } from 'vitest';
import type { TAbstractFile } from 'obsidian';
import { expandSelection } from '../src/triggers/bulk-move';
import { makeFile, makeFolder } from './stubs/obsidian';

/**
 * The stub's TFile/TFolder carry only what `expandSelection` reads, but tsc
 * checks this file against the real obsidian types, where TAbstractFile also
 * has `vault` and `parent`. Faking those would mean reproducing most of Vault
 * for no benefit, so the boundary is crossed once, here, on purpose.
 */
const selection = (...files: unknown[]) => files as TAbstractFile[];

describe('expandSelection', () => {
	it('keeps markdown files', () => {
		const files = expandSelection(selection(makeFile('Inv/A.md'), makeFile('Inv/B.md')));
		expect(files.map((f) => f.path)).toEqual(['Inv/A.md', 'Inv/B.md']);
	});

	it('ignores non-markdown files', () => {
		// An image dragged into the selection is not an inventory note.
		const files = expandSelection(selection(makeFile('Inv/A.md'), makeFile('assets/cover.jpg')));
		expect(files.map((f) => f.path)).toEqual(['Inv/A.md']);
	});

	it('expands a folder', () => {
		const folder = makeFolder('Inv', [makeFile('Inv/A.md'), makeFile('Inv/B.md')]);
		expect(expandSelection(selection(folder)).map((f) => f.path)).toEqual(['Inv/A.md', 'Inv/B.md']);
	});

	it('expands nested folders', () => {
		const inner = makeFolder('Inv/Boxes', [makeFile('Inv/Boxes/C.md')]);
		const outer = makeFolder('Inv', [makeFile('Inv/A.md'), inner]);
		expect(
			expandSelection(selection(outer))
				.map((f) => f.path)
				.sort(),
		).toEqual([
			'Inv/A.md',
			'Inv/Boxes/C.md',
		]);
	});

	it('de-duplicates a file selected both directly and through its folder', () => {
		const file = makeFile('Inv/A.md');
		const folder = makeFolder('Inv', [file]);
		expect(expandSelection(selection(folder, file))).toHaveLength(1);
	});

	it('handles an empty selection', () => {
		expect(expandSelection(selection())).toEqual([]);
	});

	it('handles an empty folder', () => {
		expect(expandSelection(selection(makeFolder('Empty')))).toEqual([]);
	});
});
