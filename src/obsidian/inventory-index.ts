import { TFile, type App, type CachedMetadata } from 'obsidian';
import { kindOf, readInventoryConfig } from '../core/identify';
import { parseLinkText } from '../core/link-format';
import type { InventoryConfig, InventoryNote, PropertyNames } from '../core/schema';

/**
 * Turns Obsidian's metadata cache into the resolved shape `core/` works with.
 *
 * This is the only place links are resolved. Everything downstream compares
 * paths, which is what makes the decision logic testable without an app - and
 * it mirrors what Bases itself does, since Link equality there resolves to the
 * target file rather than comparing raw text (probe P3).
 */

/**
 * `FrontMatterCache` is index-typed as `any`, which would leak into every value
 * read out of it. Narrowed once, here, so the rest of the plugin handles
 * `unknown` and has to check before it trusts anything.
 */
function frontmatterOf(cache: CachedMetadata | null): Record<string, unknown> | undefined {
	const raw: unknown = cache?.frontmatter;
	return typeof raw === 'object' && raw !== null && !Array.isArray(raw)
		? (raw as Record<string, unknown>)
		: undefined;
}

interface ResolvedLink {
	path: string | null;
	/** A value was present but resolved to nothing. */
	dangling: boolean;
}

export class InventoryIndex {
	constructor(
		private readonly app: App,
		private readonly names: () => PropertyNames,
	) {}

	/**
	 * Resolves one link-valued property.
	 *
	 * Prefers `frontmatterLinks`, which Obsidian maintains and keeps correct
	 * through renames. Falls back to parsing the raw value, which is only
	 * needed for notes this plugin did not write - a bare path, say, or a
	 * markdown-style link.
	 */
	private resolveLink(file: TFile, cache: CachedMetadata | null, key: string): ResolvedLink {
		const tracked = cache?.frontmatterLinks?.find((entry) => entry.key === key);
		const raw = tracked?.link ?? parseLinkText(frontmatterOf(cache)?.[key]);
		if (!raw) return { path: null, dangling: false };

		const target = this.app.metadataCache.getFirstLinkpathDest(raw, file.path);
		return target ? { path: target.path, dangling: false } : { path: null, dangling: true };
	}

	/** The resolved view of a note. Never throws; an unknown note reads as untyped. */
	noteFor(file: TFile): InventoryNote {
		const names = this.names();
		const cache = this.app.metadataCache.getFileCache(file);
		const frontmatter = frontmatterOf(cache);

		const inventory = this.resolveLink(file, cache, names.inventory);
		const container = this.resolveLink(file, cache, names.container);
		const id = frontmatter?.[names.id];

		return {
			ref: { path: file.path, basename: file.basename },
			kind: kindOf(frontmatter, names),
			inventoryPath: inventory.path,
			inventoryDangling: inventory.dangling,
			containerPath: container.path,
			containerDangling: container.dangling,
			id: typeof id === 'string' ? id : null,
		};
	}

	/** Every markdown note this plugin recognises, with links resolved. */
	all(): InventoryNote[] {
		return this.app.vault
			.getMarkdownFiles()
			.map((file) => this.noteFor(file))
			.filter((note) => note.kind !== null);
	}

	/**
	 * Containers, optionally narrowed to one inventory.
	 *
	 * A null `inventoryPath` means "no inventory known", in which case every
	 * container is offered rather than none - refusing to show anything would
	 * strand a note that simply has not been assigned yet.
	 */
	containers(inventoryPath: string | null): InventoryNote[] {
		const containers = this.all().filter((note) => note.kind === 'container');
		if (inventoryPath === null) return containers;

		const scoped = containers.filter((note) => note.inventoryPath === inventoryPath);
		return scoped.length > 0 ? scoped : containers;
	}

	/** Every inventory root note in the vault. */
	inventories(): InventoryNote[] {
		return this.all()
			.filter((note) => note.kind === 'inventory')
			.sort((a, b) => a.ref.basename.localeCompare(b.ref.basename));
	}

	/**
	 * The inventory a note belongs to.
	 *
	 * An inventory root belongs to itself, which is what lets the command work
	 * from the overview note as well as from a member note.
	 */
	inventoryOf(note: InventoryNote): string | null {
		if (note.kind === 'inventory') return note.ref.path;
		return note.inventoryPath;
	}

	/** Config from an inventory root note, by path. */
	configFor(inventoryPath: string): InventoryConfig {
		const file = this.app.vault.getFileByPath(inventoryPath);
		if (!(file instanceof TFile)) return readInventoryConfig(undefined);
		return readInventoryConfig(this.app.metadataCache.getFileCache(file)?.frontmatter);
	}

	fileFor(note: InventoryNote): TFile | null {
		const file = this.app.vault.getFileByPath(note.ref.path);
		return file instanceof TFile ? file : null;
	}

	/**
	 * The link text to store when pointing at `target` from `source`.
	 *
	 * Obsidian decides the form here, honouring the vault's link settings and
	 * picking the shortest unambiguous variant. We never build a path.
	 */
	linktextFor(target: TFile, sourcePath: string): string {
		return this.app.metadataCache.fileToLinktext(target, sourcePath);
	}
}
