import type { PropertyNames } from './schema';

/**
 * The Bases blocks written into new notes.
 *
 * These filters are the probe outcome (P1-P3) turned into code. They compare
 * Link values directly, which Bases resolves by target - so a link written as
 * `[[Chain Box]]`, `[[Inventory/Chain Box]]` or `[[Inventory/Chain Box|the box]]`
 * all match. Two rules hold here and are covered by tests:
 *
 *   - never `file.hasLink(this.file)`: it also matches an item that merely
 *     mentions the container in its body
 *   - never `asFile()`: dereferencing costs per row and buys nothing, because
 *     Link equality already resolves
 *
 * What they deliberately do NOT do is read any property beyond the four the
 * model is built on. An earlier version ordered cards by `quantity` and shipped
 * a "Restock" view filtered on `restock == true`, which meant every container
 * in every vault carried a tab for a workflow most inventories do not have. A
 * generated view should show what the plugin knows - which notes belong here -
 * and leave the columns to the person who knows what they are inventorying.
 *
 * Kept as plain strings rather than built from a YAML library on purpose: this
 * is user-editable content, and it should land in the note looking exactly the
 * way a person would have written it.
 */

export interface BaseOptions {
	/**
	 * Bind `cover` / `banner` as the card image.
	 *
	 * A setting rather than a per-inventory declaration because the inventory
	 * root's own two views are written at the moment the root note is created,
	 * before it can declare anything - and re-adding the binding by hand to
	 * every container's block afterwards is exactly the tedium worth avoiding.
	 */
	cardImages: boolean;
}

/** Drops the lines an option switched off, keeping the block free of blanks. */
function block(lines: (string | null)[]): string {
	return lines.filter((line): line is string => line !== null).join('\n');
}

/** Lists the items sitting in this container. Goes in a container note. */
export function containerBase(names: PropertyNames, options: BaseOptions): string {
	return block([
		'```base',
		'filters:',
		'  and:',
		`    - note.${names.type} == "item"`,
		`    - ${names.container} == this.file.asLink()`,
		'properties:',
		'  file.name:',
		'    displayName: Item',
		'views:',
		'  - type: cards',
		'    name: Content',
		'    order:',
		'      - file.name',
		'    sort:',
		'      - property: file.name',
		'        direction: ASC',
		'    cardSize: 200',
		options.cardImages ? `    image: note.${names.cover}` : null,
		'```',
	]);
}

/** Overview of one inventory: its containers, and its items grouped by container. */
export function inventoryBody(names: PropertyNames, options: BaseOptions): string {
	return block([
		'# Containers',
		'',
		'```base',
		'filters:',
		'  and:',
		`    - note.${names.type} == "container"`,
		`    - ${names.inventory} == this.file.asLink()`,
		'properties:',
		'  file.name:',
		'    displayName: Container',
		'views:',
		'  - type: cards',
		'    name: Containers',
		'    order:',
		'      - file.name',
		'    sort:',
		'      - property: file.name',
		'        direction: ASC',
		'    cardSize: 200',
		options.cardImages ? `    image: note.${names.banner}` : null,
		options.cardImages ? '    imageAspectRatio: 0.4' : null,
		'```',
		'',
		'# Items',
		'',
		'```base',
		'filters:',
		'  and:',
		`    - note.${names.type} == "item"`,
		`    - ${names.inventory} == this.file.asLink()`,
		'properties:',
		'  file.name:',
		'    displayName: Item',
		'views:',
		'  - type: cards',
		'    name: By container',
		'    groupBy:',
		`      property: ${names.container}`,
		'      direction: ASC',
		'    order:',
		'      - file.name',
		'    sort:',
		'      - property: file.name',
		'        direction: ASC',
		'    cardSize: 200',
		options.cardImages ? `    image: note.${names.cover}` : null,
		options.cardImages ? '    imageAspectRatio: 0.4' : null,
		'```',
	]);
}
