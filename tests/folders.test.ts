import { describe, expect, it } from 'vitest';
import { isUnder, MAX_FOLDER_SUGGESTIONS, rankFolders } from '../src/core/folders';

/** A vault shaped like the one in the README, plus somewhere unrelated. */
const vault = [
	'Films',
	'Films/Genres',
	'Films/Genres/Individual Movies',
	'Films/Posters',
	'Archive',
	'Archive/Generated',
	'Notes',
];

describe('isUnder', () => {
	it('counts the folder itself and its descendants', () => {
		expect(isUnder('Films', 'Films')).toBe(true);
		expect(isUnder('Films/Genres', 'Films')).toBe(true);
	});

	it('does not count a folder that merely shares a prefix', () => {
		// `Filmstrips` starts with `Films` as a string but is not inside it.
		expect(isUnder('Filmstrips', 'Films')).toBe(false);
	});

	it('counts nothing as under the vault root', () => {
		// An inventory at the vault root has no folder to privilege, so the
		// ordering falls through to how well each folder matches.
		expect(isUnder('Films', null)).toBe(false);
	});
});

describe('rankFolders', () => {
	it('offers every folder for an empty query', () => {
		expect(rankFolders(vault, '', null)).toHaveLength(vault.length);
	});

	it('puts the inventory’s own folder and its descendants first', () => {
		// `Archive/Generated` matches "gen" as well as `Films/Genres` does, and
		// still comes second: a worse match nearby beats a better one elsewhere.
		expect(rankFolders(vault, 'gen', 'Films')).toEqual([
			'Films/Genres',
			'Films/Genres/Individual Movies',
			'Archive/Generated',
		]);
	});

	it('completes a partial path as typed in the property field', () => {
		expect(rankFolders(vault, 'Films/Gen', 'Films')).toEqual([
			'Films/Genres',
			'Films/Genres/Individual Movies',
		]);
	});

	it('ignores case and padding', () => {
		// Both are what a person actually types into the field.
		const expected = ['Films/Genres', 'Films/Genres/Individual Movies'];
		expect(rankFolders(vault, 'films/gen', 'Films')).toEqual(expected);
		expect(rankFolders(vault, '  Films/Gen  ', 'Films')).toEqual(expected);
	});

	it('drops a trailing slash rather than treating it as another folder', () => {
		// `Films/Genres/` names the same folder as `Films/Genres`, so it is an
		// exact match and stops filtering - not a near-miss with its own list.
		expect(rankFolders(vault, 'Films/Genres/', 'Films')).toEqual(
			rankFolders(vault, 'Films/Genres', 'Films'),
		);
	});

	it('never offers the same folder twice over a trailing slash', () => {
		// Two rows reading as one folder, one of them a typo waiting to be
		// written into a note.
		expect(rankFolders(['Films/Genres', 'Films/Genres/'], '', null)).toEqual(['Films/Genres']);
	});

	it('ignores a blank path, which no folder property can express', () => {
		expect(rankFolders(['', '/', 'Films'], '', null)).toEqual(['Films']);
	});

	describe('a query that already names a folder', () => {
		/**
		 * Re-opening the dropdown on a field that is already set used to be a
		 * dead end: the value was an exact match, so the only rows on offer were
		 * that folder and whatever sat beneath it - never the folder elsewhere
		 * you opened the list to switch to.
		 */
		it('stops filtering, so every other folder stays reachable', () => {
			expect(rankFolders(vault, 'Archive', 'Films')).toEqual(rankFolders(vault, '', 'Films'));
		});

		it('still narrows while the name is only partly typed', () => {
			// `Archiv` names nothing, so it filters as usual - the escape hatch
			// opens on the exact match, not on the way to it.
			expect(rankFolders(vault, 'Archiv', 'Films')).toEqual(['Archive', 'Archive/Generated']);
		});
	});

	it('matches a segment anywhere in the path', () => {
		expect(rankFolders(vault, 'individual', 'Films')).toEqual(['Films/Genres/Individual Movies']);
	});

	it('falls back to a substring match', () => {
		// `enre` starts no segment, so only the loosest tier can find it.
		expect(rankFolders(vault, 'enre', null)).toEqual(['Films/Genres', 'Films/Genres/Individual Movies']);
	});

	it('prefers a path prefix over a mid-path match at the same locality', () => {
		expect(rankFolders(['Archive/Generated', 'Generated'], 'gener', null)).toEqual([
			'Generated',
			'Archive/Generated',
		]);
	});

	it('sorts shallower folders first, then alphabetically', () => {
		expect(rankFolders(vault, '', 'Films')).toEqual([
			'Films',
			'Films/Genres',
			'Films/Posters',
			'Films/Genres/Individual Movies',
			'Archive',
			'Notes',
			'Archive/Generated',
		]);
	});

	it('returns nothing when the query matches nothing', () => {
		expect(rankFolders(vault, 'zzz', 'Films')).toEqual([]);
	});

	it('caps the list so the dropdown stays readable', () => {
		const many = Array.from({ length: 200 }, (_, n) => `Folder ${n}`);
		expect(rankFolders(many, '', null)).toHaveLength(MAX_FOLDER_SUGGESTIONS);
		expect(rankFolders(many, '', null, 3)).toHaveLength(3);
	});

	it('ranks without a home folder rather than failing', () => {
		// An inventory at the vault root; nothing is local, so match quality and
		// then depth decide - which is what drops `Films/Genres` to second.
		expect(rankFolders(vault, 'gen', null)).toEqual([
			'Archive/Generated',
			'Films/Genres',
			'Films/Genres/Individual Movies',
		]);
	});
});
