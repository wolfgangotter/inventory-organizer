import { linkValue } from './link-format';
import { mergeFrontmatter } from './property-defaults';
import { containerBase, inventoryBody, type BaseOptions } from './templates';
import { INVENTORY_CONFIG_KEYS, type PropertyDefaults, type PropertyNames } from './schema';

/**
 * What a new note contains, before it touches the vault.
 *
 * Frontmatter is handed over as a plain record and written by Obsidian's
 * `processFrontMatter`, never serialised here - the plugin has one YAML writer
 * and this is not it.
 *
 * A new note carries only what makes it a member of its inventory: the type,
 * the links, an id and the tags. Nothing else is guessed. An earlier version
 * seeded `quantity`, `restock` and an empty `cover` on every item, which is
 * fine for a bin of brake cables and noise for a film collection - and because
 * a seed is written before the inventory's declaration is read, there was no
 * way for the user to take one back. Anything an inventory wants on its notes
 * it declares in `item_defaults` / `container_defaults`; see
 * `core/property-defaults`. The single exception is the card image, which is a
 * plugin setting because the views that bind it are generated here too.
 */
export interface NewNoteSpec {
	frontmatter: Record<string, unknown>;
	body: string;
}

export interface NewInventoryOptions extends BaseOptions {
	tags: string[];
	itemFolder: string | null;
	containerFolder: string | null;
}

export interface NewContainerOptions extends BaseOptions {
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

/**
 * The one seed left, and only when the card images setting is on: the views
 * about to be written bind this property, so the note gets the row to drop a
 * picture onto. Switched off, the key is not written at all.
 */
function imageSeed(property: string, options: BaseOptions): Record<string, unknown> {
	return options.cardImages ? { [property]: '' } : {};
}

export function newInventory(names: PropertyNames, options: NewInventoryOptions): NewNoteSpec {
	// An inventory root takes no declared defaults: it is the note that declares
	// them, and stamping an inventory with its own item fields makes no sense.
	// It gets no banner either - none of the two views below render the root's
	// own image, so the row would be a property nothing reads.
	const frontmatter: Record<string, unknown> = {
		[names.type]: 'inventory',
		[INVENTORY_CONFIG_KEYS.defaultTags]: [...options.tags],
	};
	// Folder keys are omitted rather than written as null: an absent key reads
	// as "no preference", where an explicit null looks like a broken setting.
	if (options.itemFolder) frontmatter[INVENTORY_CONFIG_KEYS.itemFolder] = options.itemFolder;
	if (options.containerFolder) {
		frontmatter[INVENTORY_CONFIG_KEYS.containerFolder] = options.containerFolder;
	}

	return { frontmatter, body: inventoryBody(names, options) };
}

export function newContainer(names: PropertyNames, options: NewContainerOptions): NewNoteSpec {
	return {
		frontmatter: mergeFrontmatter(
			// The inventory's own declaration still wins over the seeded banner,
			// which is how a container gets a placeholder image instead of a blank.
			imageSeed(names.banner, options),
			options.defaults,
			{
				[names.type]: 'container',
				[names.inventory]: linkValue(options.inventoryLinktext),
				[names.id]: options.id,
				tags: [...options.tags],
			},
		),
		body: containerBase(names, options),
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
		frontmatter: mergeFrontmatter(imageSeed(names.cover, options), options.defaults, structural),
		body: '',
	};
}
