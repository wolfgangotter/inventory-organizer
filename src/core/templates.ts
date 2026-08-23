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
 * Kept as plain strings rather than built from a YAML library on purpose: this
 * is user-editable content, and it should land in the note looking exactly the
 * way a person would have written it.
 */

/** Lists the items sitting in this container. Goes in a container note. */
export function containerBase(): string {
	return [
		'```base',
		'filters:',
		'  and:',
		'    - note.type == "item"',
		'    - container == this.file.asLink()',
		'properties:',
		'  file.name:',
		'    displayName: Item',
		'views:',
		'  - type: cards',
		'    name: Content',
		'    order:',
		'      - file.name',
		'      - quantity',
		'      - restock',
		'    sort:',
		'      - property: file.name',
		'        direction: ASC',
		'    cardSize: 200',
		'    image: note.cover',
		'  - type: table',
		'    name: Restock',
		'    filters:',
		'      and:',
		'        - restock == true',
		'```',
	].join('\n');
}

/** Overview of one inventory: its containers, and its items grouped by container. */
export function inventoryBody(): string {
	return [
		'# Containers',
		'',
		'```base',
		'filters:',
		'  and:',
		'    - note.type == "container"',
		'    - inventory == this.file.asLink()',
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
		'    image: note.banner',
		'    imageAspectRatio: 0.4',
		'```',
		'',
		'# Items',
		'',
		'```base',
		'filters:',
		'  and:',
		'    - note.type == "item"',
		'    - inventory == this.file.asLink()',
		'properties:',
		'  file.name:',
		'    displayName: Item',
		'views:',
		'  - type: cards',
		'    name: By container',
		'    groupBy:',
		'      property: container',
		'      direction: ASC',
		'    order:',
		'      - file.name',
		'      - quantity',
		'    sort:',
		'      - property: file.name',
		'        direction: ASC',
		'    cardSize: 200',
		'    image: note.cover',
		'    imageAspectRatio: 0.4',
		'  - type: table',
		'    name: Restock',
		'    filters:',
		'      and:',
		'        - restock == true',
		'    order:',
		'      - file.name',
		'      - container',
		'      - quantity',
		'```',
	].join('\n');
}
