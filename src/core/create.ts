import { linkValue } from './link-format';
import { containerBase, inventoryBody } from './templates';
import { INVENTORY_CONFIG_KEYS, type PropertyNames } from './schema';

/**
 * What a new note contains, before it touches the vault.
 *
 * Frontmatter is handed over as a plain record and written by Obsidian's
 * `processFrontMatter`, never serialised here - the plugin has one YAML writer
 * and this is not it.
 */
export interface NewNoteSpec {
	frontmatter: Record<string, unknown>;
	body: string;
}

export interface NewInventoryOptions {
	tags: string[];
	itemFolder: string | null;
	containerFolder: string | null;
}

export interface NewContainerOptions {
	/** Linktext of the inventory root, produced by Obsidian. */
	inventoryLinktext: string;
	tags: string[];
	id: string;
}

export interface NewItemOptions extends NewContainerOptions {
	/** Linktext of the container, or null to create an unplaced item. */
	containerLinktext: string | null;
}

export function newInventory(options: NewInventoryOptions): NewNoteSpec {
	const frontmatter: Record<string, unknown> = {
		type: 'inventory',
		[INVENTORY_CONFIG_KEYS.defaultTags]: [...options.tags],
	};
	// Folder keys are omitted rather than written as null: an absent key reads
	// as "no preference", where an explicit null looks like a broken setting.
	if (options.itemFolder) frontmatter[INVENTORY_CONFIG_KEYS.itemFolder] = options.itemFolder;
	if (options.containerFolder) {
		frontmatter[INVENTORY_CONFIG_KEYS.containerFolder] = options.containerFolder;
	}

	return { frontmatter, body: inventoryBody() };
}

export function newContainer(names: PropertyNames, options: NewContainerOptions): NewNoteSpec {
	return {
		frontmatter: {
			[names.type]: 'container',
			[names.inventory]: linkValue(options.inventoryLinktext),
			[names.id]: options.id,
			tags: [...options.tags],
		},
		body: containerBase(),
	};
}

export function newItem(names: PropertyNames, options: NewItemOptions): NewNoteSpec {
	const frontmatter: Record<string, unknown> = {
		[names.type]: 'item',
		[names.inventory]: linkValue(options.inventoryLinktext),
		[names.id]: options.id,
		tags: [...options.tags],
		// Sensible starting values so the Bases views have something to show and
		// the restock filter works from the first note.
		[names.quantity]: 1,
		[names.restock]: false,
	};
	if (options.containerLinktext !== null) {
		frontmatter[names.container] = linkValue(options.containerLinktext);
	}

	return { frontmatter, body: '' };
}
