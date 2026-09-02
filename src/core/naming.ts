/**
 * Turning a user-typed title into a vault path.
 *
 * This is a security boundary, not a formatting nicety: the title comes
 * straight from a text field, and it is concatenated with a folder to form a
 * path handed to `vault.create`. A title of `../../secrets` must not be able to
 * write outside the intended folder, and a title of `..` must not resolve to
 * the parent directory.
 */

/** Characters Obsidian and the major filesystems reject in a file name. */
const ILLEGAL = /[\\/:*?"<>|#^[\]]/g;

/** Reserved device names on Windows; a vault may well be synced there. */
const RESERVED = new Set([
	'con',
	'prn',
	'aux',
	'nul',
	'com1',
	'com2',
	'com3',
	'com4',
	'com5',
	'com6',
	'com7',
	'com8',
	'com9',
	'lpt1',
	'lpt2',
	'lpt3',
	'lpt4',
	'lpt5',
	'lpt6',
	'lpt7',
	'lpt8',
	'lpt9',
]);

/** Leaves room for the ` 12.md` uniqueness suffix inside a 255-byte limit. */
const MAX_LENGTH = 180;

/**
 * Drops C0 controls and DEL.
 *
 * Written as a code-point scan rather than a regex range so the source file
 * contains no control characters of its own - they survive copy/paste and diff
 * review badly, and a stray one in a character class is invisible.
 */
function stripControl(value: string): string {
	let out = '';
	for (const ch of value) {
		const code = ch.codePointAt(0) ?? 0;
		if (code < 0x20 || code === 0x7f) continue;
		out += ch;
	}
	return out;
}

/**
 * A file name safe to concatenate with a folder.
 *
 * Returns null when nothing usable survives, which the caller must treat as a
 * refusal rather than substituting a default - silently renaming a user's note
 * is worse than telling them the title was unusable.
 */
export function sanitizeFileName(raw: string): string | null {
	let name = stripControl(raw.normalize('NFC')).replace(ILLEGAL, '');

	// Collapse whitespace so ` a   b ` and `a b` cannot both exist confusingly.
	name = name.replace(/\s+/g, ' ').trim();

	// Leading dots hide the file; a name of "." or ".." is a path segment, not
	// a name. Strip them entirely rather than trying to be clever.
	name = name.replace(/^\.+/, '').replace(/\.+$/, '').trim();

	if (!name) return null;
	if (RESERVED.has(name.toLowerCase())) return null;
	if (name.length > MAX_LENGTH) name = name.slice(0, MAX_LENGTH).trim();

	return name || null;
}

/** The folder part of a vault path, or null for a note at the vault root. */
export function folderOf(path: string): string | null {
	const folder = path.split('/').slice(0, -1).join('/');
	return folder || null;
}

/**
 * Where a new member of an inventory is written.
 *
 * The declared folder when there is one, and otherwise the folder the inventory
 * note itself sits in. That fallback is the documented behaviour rather than an
 * implementation detail: deleting `container_folder` means "next to the
 * inventory", not "at the vault root", which is what a plain null would give.
 */
export function memberFolder(declared: string | null, inventoryPath: string): string | null {
	return declared ?? folderOf(inventoryPath);
}

/** Joins a folder and file name into a vault-relative path. */
export function joinPath(folder: string | null, fileName: string): string {
	const clean = (folder ?? '').replace(/^\/+/, '').replace(/\/+$/, '').trim();
	return clean ? `${clean}/${fileName}.md` : `${fileName}.md`;
}

/**
 * First free path of the form `Name.md`, `Name 1.md`, `Name 2.md`, ...
 *
 * `exists` is injected so this stays pure and the adapter can back it with the
 * real vault. Bounded so a pathological vault cannot spin forever.
 */
export function uniquePath(
	folder: string | null,
	fileName: string,
	exists: (path: string) => boolean,
): string {
	const first = joinPath(folder, fileName);
	if (!exists(first)) return first;

	for (let n = 1; n < 1000; n++) {
		const candidate = joinPath(folder, `${fileName} ${n}`);
		if (!exists(candidate)) return candidate;
	}
	// Astronomically unlikely; a timestamp is still better than overwriting.
	return joinPath(folder, `${fileName} ${Date.now()}`);
}
