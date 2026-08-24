# Inventory Organizer

Create inventories in Obsidian to keep track of all sorts of things (bike parts,
workshop tools, camera equipment, etc.) using nothing but frontmatter links and
native [Bases](https://obsidian.md/help/bases).

The plugin does not build a database, a view, or a UI of its own. It maintains
three properties and gets out of the way, so what you end up with is a pile of
ordinary notes that keep working whether or not this plugin is installed.

## The idea

An **item** note points at the **container** it sits in, and both point at the
**inventory** they belong to. All three are ordinary wikilinks:

```yaml
---
type: item
inventory: "[[Bike Workshop]]"
container: "[[Brake & Tire Box]]"
quantity: 1
restock: false
---
```

Because these are links rather than opaque ids, Obsidian does most of the work
for free:

- **Grouped views read properly.** `groupBy: container` in a Base shows
  *"Brake & Tire Box"*, not a uuid.
- **Renaming a container fixes every item**, because Obsidian rewrites links in
  frontmatter.
- **A container's backlinks are its contents.** No query needed.
- **Clicking the property opens the container.**
- **Bases filters compare links by target**, so `[[Chain Box]]`,
  `[[Inventory/Chain Box]]` and `[[Inventory/Chain Box|the box]]` all match.

## What the plugin adds

Everything above is native. The plugin covers what Obsidian leaves out:

| Command | What it does |
|---|---|
| **Move item to container** | A picker showing *this inventory's* containers — not all 4,000 notes in your vault. Recently used first. |
| **Create inventory** | Scaffolds a root note with both overview Bases, ready to use. |
| **Create container** | Fills in `inventory`, `id` and your default tags; embeds a contents Base. |
| **Create item** | Same, and pre-fills the container when you are already looking at one. |
| **Validate inventory** | Finds dangling containers, unplaced items, untyped notes, duplicate container names. Every row opens the note. |
| **Undo last bulk move** | Puts a bulk move back. Session only. |

Plus, outside the palette:

- A **button on the `container` property** of item notes — one tap to move,
  open the container, or take the item out of it.
- **Bulk move** from a file-explorer multi-selection (right-click → *Move 7
  items to container*), with folders expanded.

## Getting started

1. Run **Create inventory** and name it.
2. Add your tags to `default_tags` in its frontmatter — they will be stamped on
   every note the inventory creates.
3. Run **Create container**, then **Create item** from inside that container.
4. Optional: declare any extra properties your items should carry, under
   [Your own properties](#your-own-properties).

The inventory note already contains the two Bases that list your containers and
your items grouped by container.

## Properties

| Property | On | Meaning |
|---|---|---|
| `type` | all | `item`, `container` or `inventory`. Structure lives here, not in tags. |
| `inventory` | items, containers | Link to the inventory root. |
| `container` | items | Link to the containing container. |
| `quantity`, `restock` | items | Seeded on creation; yours to use. |
| `cover` | items | Card image. Seeded empty so you can drop a picture on it. |
| `banner` | inventories, containers | Header image, shown by the overview views. |
| `id` | items, containers | A durable key for exporting elsewhere. **Nothing in the plugin reads it.** |
| `item_folder`, `container_folder`, `default_tags` | inventory | Where new notes go and what tags they get. |
| `item_defaults`, `container_defaults` | inventory | Extra properties to stamp on new notes — see below. |

Tags are left entirely to you. `bike`, `workshop` and the rest carry meaning for
you, not for the plugin.

Every property name is configurable if `type` or `container` is already taken in
your vault.

### Your own properties

The table above is what the plugin needs. Anything else your inventory should
carry, you declare on the inventory root note itself:

```yaml
type: inventory
item_defaults:
  condition: new
  purchased:
  warranty_months: 24
container_defaults:
  location: shelf
```

Every item this inventory creates now starts with a `condition`, an empty
`purchased` date and a `warranty_months`; every container starts with a
`location`. Edit the block in Obsidian's own property editor — there is no
separate settings screen for it, and the declaration lives in the vault, so it
syncs to your other devices along with the notes.

Worth knowing:

- It is **per inventory**. A pantry and a bike workshop want different fields,
  and each declares its own.
- A declaration **overrides** what the plugin seeds. Setting `quantity: 0` or
  `cover: "[[placeholder.png]]"` in `item_defaults` does what you would expect.
- It **cannot** touch `type`, `inventory`, `container` or `id`. Those are what
  makes a note findable; entries for them are ignored.
- Values are single values or flat lists. Nested blocks are ignored, because the
  property editor cannot edit them back out.
- It applies to notes created **from then on**. Existing notes are left alone.

## Settings

- **Button on the container property** — this is the one feature built on
  Obsidian's internal layout, so it can stop working after an update. Every
  command works without it, and you can switch it off.
- **Confirm moves between inventories** — moving an item into another
  inventory's container is allowed, but asks first.

## Design notes

**Why links and not ids.** An earlier version of this system used a uuid in
`container`. It worked, but nothing in Obsidian could resolve it: moving an item
meant copy-pasting a uuid by hand, and every grouped view showed opaque strings.
Links solve both, and Bases can compare them by resolved target — so the ids
became unnecessary. They are still written, and still ignored.

**Bulk moves are confirmed and undoable.** Obsidian's undo is per-editor, so a
write across forty notes cannot be taken back by hand. Bulk move therefore
always confirms, and registers a session undo. Writes run sequentially and a
partial failure is reported rather than rolled back — there is no transaction to
roll back to, and pretending otherwise would be worse than saying what happened.

**Nothing is auto-fixed.** Validation reports; it never repairs. Each finding
has several plausible fixes and choosing one for you is how data gets quietly
lost.

## Development

```bash
npm install
npm run dev     # watch build
npm run check   # typecheck + lint + tests
```

`src/core/` is pure — it imports nothing from Obsidian and holds every decision
the plugin makes, which is why most of the test suite can run without an app.
`src/obsidian/property-dom.ts` is the only file coupled to Obsidian's internal
DOM, and it is written to fail soft.

## License

MIT
