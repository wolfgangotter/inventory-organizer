import { linkValue } from './link-format';
import { mergeFrontmatter } from './property-defaults';
import { containerBase, inventoryBody } from './templates';
import {
	INVENTORY_CONFIG_KEYS,
	type PropertyDefaults,
	type PropertyNames,
} from './schema';

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
	/** Extra properties declared by the inventory, already checked. */
	defaults: PropertyDefaults;
}

export interface NewItemOptions extends NewContainerOptions {
	/** Linktext of the container, or null to create an unplaced item. */
	containerLinktext: string | null;
}

export function newInventory(names: PropertyNames, options: NewInventoryOptions): NewNoteSpec {
	// An inventory root takes no declared defaults: it is the note that declares
	// them, and stamping an inventory with its own item fields makes no sense.
	const frontmatter: Record<string, unknown> = {
		[names.type]: 'inventory',
		// Empty so the row is visible in the property editor and the overview
		// views have something to bind; the user drops an image on it.
		[names.banner]: '',
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
		frontmatter: mergeFrontmatter(
			// Seeds: overridable starting values. The inventory's own declaration
			// wins over these, which is how a container gets a placeholder banner.
			{ [names.banner]: '' },
			options.defaults,
			{
				[names.type]: 'container',
				[names.inventory]: linkValue(options.inventoryLinktext),
				[names.id]: options.id,
				tags: [...options.tags],
			},
		),
		body: containerBase(),
	};
}

export function newItem(names: PropertyNames, options: NewItemOptions): NewNoteSpec {
	const structural: Record<string, unknown> = {
		[names.type]: 'item',
		[names.inventory]: linkValue(options.inventoryLinktext),
		[names.id]: options.id,
		tags: [...options.tags],
	};
	if (options.containerLinktext !== null) {
		structural[names.container] = linkValue(options.containerLinktext);
	}

	return {
		frontmatter: mergeFrontmatter(
			// Sensible starting values so the Bases views have something to show
			// and the restock filter works from the first note. All overridable:
			// an inventory that counts in kilograms starts elsewhere than 1.
			{ [names.quantity]: 1, [names.restock]: false, [names.cover]: '' },
			options.defaults,
			structural,
		),
		body: '',
	};
}
