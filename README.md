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
---
```

That is the whole note a new item starts as. Everything else it should carry —
a quantity, a condition, a restock checkbox — is [yours to
declare](#your-own-properties), because a bin of brake cables and a film
collection do not want the same fields.

Because these are links rather than opaque ids, Obsidian does most of the work
for free:

- **Grouped views read properly.** `groupBy: container` in a Base shows
  _"Brake & Tire Box"_, not a uuid.
- **Renaming a container fixes every item**, because Obsidian rewrites links in
  frontmatter.
- **A container's backlinks are its contents.** No query needed.
- **Clicking the property opens the container.**
- **Bases filters compare links by target**, so `[[Chain Box]]`,
  `[[Inventory/Chain Box]]` and `[[Inventory/Chain Box|the box]]` all match.

## What the plugin adds

Everything above is native. The plugin covers what Obsidian leaves out:

| Command                    | What it does                                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Move item to container** | A picker showing _this inventory's_ containers — not all 4,000 notes in your vault. Recently used first.       |
| **Create inventory**       | Scaffolds a root note with both overview Bases, ready to use.                                                  |
| **Create container**       | Fills in `inventory`, `id` and your default tags; embeds a contents Base.                                      |
| **Create item**            | Same, and pre-fills the container when you are already looking at one.                                         |
| **Validate inventory**     | Finds dangling containers, unplaced items, untyped notes, duplicate container names. Every row opens the note. |
| **Set item folder**        | Picks where new items go, from the vault's folders. Same for **Set container folder**.                         |
| **Undo last bulk move**    | Puts a bulk move back. Session only.                                                                           |

Plus, outside the palette:

- A **button on the `container` property** of item notes — one tap to move,
  open the container, or take the item out of it.
- **Bulk move** from a file-explorer multi-selection (right-click → _Move 7
  items to container_), with folders expanded.
- **Folder autocomplete** while typing in an inventory's `container_folder` and
  `item_folder` properties, offering the inventory's own subfolders first.

## Getting started

1. Run **Create inventory** and name it.
2. Add your tags to `default_tags` in its frontmatter — they will be stamped on
   every note the inventory creates.
3. Run **Create container**, then **Create item** from inside that container.
4. Declare any properties your items should carry — a quantity, a condition, a
   restock checkbox — under [Your own properties](#your-own-properties).

The inventory note already contains the two Bases that list your containers and
your items grouped by container.

## Properties

| Property                                          | On                | Meaning                                                                      |
| ------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------- |
| `type`                                            | all               | `item`, `container` or `inventory`. Structure lives here, not in tags.       |
| `inventory`                                       | items, containers | Link to the inventory root.                                                  |
| `container`                                       | items             | Link to the containing container.                                            |
| `cover`, `banner`                                 | items, containers | Card image, written only with **Card images** on. See [Settings](#settings). |
| `id`                                              | items, containers | A durable key for exporting elsewhere. **Nothing in the plugin reads it.**   |
| `container_folder`, `item_folder`, `default_tags` | inventory         | Where new notes go and what tags they get.                                   |
| `item_defaults`, `container_defaults`             | inventory         | Extra properties to stamp on new notes — see below.                          |

That really is the whole list. A new note gets its type, its links, an id and
your tags — nothing else is guessed, and the generated Bases read nothing else
either. An earlier version seeded `quantity`, `restock` and an empty `cover` on
every item and shipped a _Restock_ view in every container; useful for a bike
workshop, noise for a shelf of films, and impossible to take back, because a
seed is written before your own declaration is read.

Tags are left entirely to you. `bike`, `workshop` and the rest carry meaning for
you, not for the plugin.

Every property name is configurable if one of them is already taken in your
vault. The two image properties have fields in the settings; the four structural
ones live in `data.json`, because renaming `container` after the fact orphans
every note still carrying the old name — that is a migration, not a setting.

Names are restricted to letters, digits and underscores, starting with a letter.
Obsidian itself is happy with `item image` or `item-image`, but these names are
written into the generated Bases, and there a space ends the identifier while a
hyphen reads as subtraction — `note.item-image` resolves to `note.item` minus
`image` and the view silently shows nothing.

### Where new notes go

`container_folder` and `item_folder` on the inventory root decide where its
containers and items are created. **Create inventory** pre-fills both with the
folder the inventory itself landed in, so a `Films` inventory created in `Films`
keeps everything together without you touching anything.

```yaml
type: inventory
container_folder: Films/Genres
item_folder: Films/Individual Movies
```

- **Leave a key out and new notes land next to the inventory note.** Deleting
  `container_folder` does not mean "the vault root" — it means the folder the
  inventory itself sits in. That is also the fallback for a value the plugin
  cannot use.
- **Paths are vault-absolute**, not relative to the inventory: `Films/Genres`,
  never `./Genres` or `../Genres`. Leading `..` segments are dropped rather than
  followed, so an inventory can never write above the vault.
- **Missing folders are created**, intermediate levels included.
- **You do not have to type the path.** Start typing in either property and the
  vault's folders are suggested, with the ones inside the inventory's own folder
  first — a `Films` inventory offers `Films/Genres` before anything else that
  happens to match. **Set item folder** and **Set container folder** in the
  command palette do the same from a picker, and include a _Beside the inventory
  note_ row that clears the key.
- **Changing a folder only affects notes created afterwards.** Nothing already
  written moves. Moving those yourself in the file explorer is safe — every link
  between them is a wikilink, so Obsidian rewrites them all.

### Your own properties

The table above is what the plugin needs. Anything else your inventory should
carry, you declare on the inventory root note itself:

```yaml
type: inventory
item_defaults:
  quantity: 1
  restock: false
  condition: new
  purchased:
  warranty_months: 24
container_defaults:
  location: shelf
```

Every item this inventory creates now starts with a `quantity`, an unticked
`restock` checkbox, a `condition`, an empty `purchased` date and a
`warranty_months`; every container starts with a `location`. Edit the block in Obsidian's own property editor — there is no
separate settings screen for it, and the declaration lives in the vault, so it
syncs to your other devices along with the notes.

Worth knowing:

- It is **per inventory**. A pantry and a bike workshop want different fields,
  and each declares its own.
- **Write the value you want, not a bare key.** Obsidian reads the type from the
  value, so `restock: false` gives you a checkbox where a bare `restock:` gives
  you an empty text row.
- With **Card images** on, a declaration **overrides** the empty `cover` the
  plugin writes — `cover: "[[placeholder.png]]"` does what you would expect.
- It **cannot** touch `type`, `inventory`, `container` or `id`. Those are what
  makes a note findable; entries for them are ignored.
- Values are single values or flat lists. Nested blocks are ignored, because the
  property editor cannot edit them back out.
- It applies to notes created **from then on**. Existing notes are left alone.

## Settings

- **Button on the container property** — this is one of two features built on
  Obsidian's internal layout, so it can stop working after an update. Every
  command works without it, and you can switch it off.
- **Folder autocomplete** — the other one. Suggests folders while you type in an
  inventory's two folder properties. **Set item folder** and **Set container
  folder** do the same job through supported API and never depend on it.
- **Confirm moves between inventories** — moving an item into another
  inventory's container is allowed, but asks first.
- **Card images** — off by default. Switched on, the Bases written into new
  notes bind an image property on item and container cards, and that property is
  written empty so there is a row to drop a picture onto. This is a plugin
  setting rather than a per-inventory declaration for one reason: an inventory
  root's own two Bases are written at the moment the root note is created,
  before it can declare anything. It applies to notes created from then on.
- **Item image property** / **Container image property** — which properties
  those are. `cover` and `banner` by default; set them to `item_image` and
  `container_image`, or to whatever your theme already reads. Both fields appear
  only while card images are on, and reject a name that another property holds
  or that the Bases could not read.

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

**Generated views read only what the plugin owns.** A container's Base lists the
notes that point at it; the inventory's Bases list its containers and its items
grouped by container. No column, filter or sort touches a property you did not
ask for, so the block is a starting point you can edit rather than a set of
assumptions you have to undo. Every property name in those blocks follows your
configured names, so renaming `container` does not leave you with views that
silently match nothing.

## Development

```bash
npm install
npm run dev     # watch build
npm run check   # typecheck + lint + tests
```

`src/core/` is pure — it imports nothing from Obsidian and holds every decision
the plugin makes, which is why most of the test suite can run without an app.
`src/obsidian/property-dom.ts` is the only file coupled to Obsidian's internal
DOM, and it is written to fail soft. Everything it offers — the move button, the
folder suggester — has a command that does the same job through public API, so a
change to Obsidian's markup costs a convenience and never a capability.

## License

MIT
