/**
 * Ranking the vault's folders for the `item_folder` / `container_folder`
 * pickers.
 *
 * Pure, so the ordering that decides what the user sees first is testable
 * without a vault. The adapter supplies the folder list; nothing here touches
 * Obsidian.
 */

/**
 * Enough that scrolling is never the only way to a folder, few enough that the
 * dropdown stays a glance rather than a list to read.
 */
export const MAX_FOLDER_SUGGESTIONS = 50;

/** How well a folder answers the query. Lower sorts first. */
const enum Match {
	/** The whole path starts with what was typed: `Films/Gen` → `Films/Genres`. */
	PathPrefix = 0,
	/** A segment starts with it: `gen` → `Films/Genres`. */
	SegmentPrefix = 1,
	/** It appears somewhere: `enre` → `Films/Genres`. */
	Substring = 2,
	None = 3,
}

function matchOf(folder: string, query: string): Match {
	if (!query) return Match.PathPrefix;

	const haystack = folder.toLowerCase();
	if (haystack.startsWith(query)) return Match.PathPrefix;
	if (haystack.split('/').some((segment) => segment.startsWith(query))) return Match.SegmentPrefix;
	if (haystack.includes(query)) return Match.Substring;
	return Match.None;
}

/**
 * One folder path, as the ranking compares them.
 *
 * A trailing slash is dropped so `Films/Genres` and `Films/Genres/` cannot both
 * be offered - two rows that read as the same folder, one of which is a typo
 * waiting to be written into a note.
 */
function normalizeFolder(folder: string): string {
	return folder.replace(/\/+$/, '');
}

/** Whether `folder` is `home` or sits inside it. */
export function isUnder(folder: string, home: string | null): boolean {
	if (home === null) return false;
	return folder === home || folder.startsWith(`${home}/`);
}

/**
 * Normalises what the user typed into something comparable with a folder path.
 *
 * Typing in the property field means the query is usually a partial path, so
 * the separators and case a person actually types - a trailing slash after
 * `Films/`, a capital F - must not decide whether anything matches.
 */
function normalizeQuery(raw: string): string {
	return raw.trim().replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
}

/**
 * The folders worth offering for `query`, best first.
 *
 * `home` is the folder the inventory note itself sits in, and everything inside
 * it outranks the rest of the vault. A `Films` inventory almost always wants
 * `Films/Genres`, and having to out-type the seventeen other vaults folders
 * that happen to contain "gen" is the thing this ordering exists to prevent -
 * without ever hiding a folder elsewhere, which an inventory is free to use.
 */
export function rankFolders(
	folders: readonly string[],
	query: string,
	home: string | null,
	limit = MAX_FOLDER_SUGGESTIONS,
): string[] {
	const seen = new Set<string>();
	const candidates: string[] = [];
	for (const raw of folders) {
		const folder = normalizeFolder(raw);
		// A blank is the vault root, which no folder property can express.
		if (!folder || seen.has(folder)) continue;
		seen.add(folder);
		candidates.push(folder);
	}

	const typed = normalizeQuery(query);
	/*
	 * A query that already names a folder exactly is a finished answer, not a
	 * filter. Narrowing to that folder and its descendants is how re-opening the
	 * dropdown on a field that is already set used to become a dead end: the
	 * only rows on offer were the value you were trying to change and whatever
	 * sat beneath it. Everything stays on offer instead, ranked as usual.
	 */
	const needle = candidates.some((folder) => folder.toLowerCase() === typed) ? '' : typed;

	const scored: { folder: string; match: Match; local: boolean }[] = [];
	for (const folder of candidates) {
		const match = matchOf(folder, needle);
		if (match === Match.None) continue;
		scored.push({ folder, match, local: isUnder(folder, home) });
	}

	scored.sort((a, b) => {
		// Inside the inventory's own folder first, however well the rest match:
		// a worse match nearby beats a better match across the vault.
		if (a.local !== b.local) return a.local ? -1 : 1;
		if (a.match !== b.match) return a.match - b.match;
		// Then the shallower folder, so `Films` precedes `Films/Genres/1998`.
		const depth = a.folder.split('/').length - b.folder.split('/').length;
		if (depth !== 0) return depth;
		return a.folder.localeCompare(b.folder);
	});

	return scored.slice(0, limit).map((entry) => entry.folder);
}
