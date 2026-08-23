/**
 * Building the frontmatter value for a link property.
 *
 * Obsidian only recognises a wikilink in frontmatter when the whole value is a
 * quoted string, and `processFrontMatter` quotes it for us as long as we hand it
 * the plain `[[...]]` text. The *linktext* itself must come from Obsidian
 * (`metadataCache.fileToLinktext`), which honours the vault's link settings and
 * picks the shortest unambiguous form - this module never invents a path.
 */

/** Wraps a linktext produced by Obsidian into a frontmatter link value. */
export function linkValue(linktext: string): string {
	return `[[${linktext}]]`;
}

/**
 * Recovers a linkpath from a raw frontmatter value.
 *
 * Only needed for migration and validation of notes this plugin did not write,
 * where the value may be a bare path or carry an alias. Live code should prefer
 * `frontmatterLinks` from the metadata cache, which Obsidian maintains.
 */
export function parseLinkText(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	if (!trimmed) return null;

	const wiki = /^!?\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/.exec(trimmed);
	if (wiki?.[1]) return wiki[1].trim() || null;

	const markdown = /^!?\[[^\]]*\]\(([^)]+)\)$/.exec(trimmed);
	if (markdown?.[1]) {
		try {
			return decodeURI(markdown[1]).trim() || null;
		} catch {
			// A malformed percent-escape is not worth failing a migration over.
			return markdown[1].trim() || null;
		}
	}

	return trimmed;
}
