# Inventory Organizer — Implementation Plan

Status: design agreed, not yet scaffolded.
Derived from the existing `test-vault/Inventory` notes, the `cover-image-picker` architecture, the
Obsidian Bases docs, and Obsidian API typings **v1.13.1**.

---

## 1. The core decision

The two problems that motivated this plugin —

1. moving an item means hand-copying a uuid, and
2. `groupBy: container` shows an opaque uuid instead of a name

— are both symptoms of one cause: **`container` holds a uuid string, which nothing in Obsidian can
resolve.** Bases *can* dereference links (`link.asFile()` → `file` with `.name` / `.properties`,
since 1.9.7). It cannot dereference a uuid, because a uuid is not a path.

The vault already admits this: every item note carries a hand-written `Container: [[Brake & Tire Box]]`
line in the body — the same denormalization, done manually.

**Decision: `container` becomes a wikilink. `id` is retained but nothing depends on it.**

This deletes the proposed `container_name` property and the whole sync problem it would have created.

### What becomes native (zero plugin code)

| Previously needed | Now provided by |
|---|---|
| Copy/paste a container uuid | Native property editor link autocomplete |
| Readable group headers | `groupBy: container` on a link property |
| `container_name` mirror property | Nothing — the link *is* the name |
| Body line `Container: [[…]]` | Nothing — the property is the link |
| "What is in this container?" | Backlinks pane; graph view |
| Container renamed | Obsidian rewrites frontmatter links (**P1**) |

### What the plugin is therefore actually for

Everything native leaves on the table:

- a **filtered** container picker — Obsidian's autocomplete offers every note in the vault, not the six containers in this inventory
- **bulk move** from a file-explorer multi-selection
- **creation commands** that pre-fill the relational fields correctly
- **validate / repair** — dangling `container`, items with no container, notes missing `type`
- a **one-shot migration** off the current uuid scheme

That is a small plugin. It is deliberately not a framework.

---

## 2. Data model (agreed)

Structure lives in properties. Tags stay for user semantics only (`bike`, `workshop`) and no longer
carry structural meaning — no more `item` / `container` / `inventarek` tags.

**Item**
```yaml
type: item
inventory: "[[Bike Workshop]]"
container: "[[Brake & Tire Box]]"
quantity: 1
restock: false
cover: "[[Tube_cover_1787403098892.jpg]]"
id: 089a5620-399e-47a4-ac17-326f328833d0   # inert; durable external key only
tags: [bike, workshop]
```

**Container**
```yaml
type: container
inventory: "[[Bike Workshop]]"
banner: "[[Brake & Tire Box_banner_1787402625684.jpg]]"
id: f37c87b8-b073-47af-9877-ba35790aa9e8   # inert
tags: [bike, workshop]
```

**Inventory root** — per-inventory config lives in the note, not in plugin settings, so it travels
with the vault and survives sync:
```yaml
type: inventory
item_folder: Inventory/Bike Workshop
container_folder: Inventory/Bike Workshop
default_tags: [bike, workshop]      # stamped onto notes this inventory creates
```

Containers are **flat** — a container has no `container` property. The model stays additive: adding
nesting later means adding `container` to container notes plus cycle detection, with no schema break
and no migration.

`id` is written on creation and preserved on migration, but no filter, view, or code path may read it.
If it ever becomes load-bearing again, that is a regression.

### Bases

Inventory root — containers:
```yaml
filters:
  and:
    - type == "container"
    - inventory == this.file.asLink()
```

Inventory root — items, grouped readably, with quantities summed per container:
```yaml
filters:
  and:
    - type == "item"
    - inventory == this.file.asLink()
views:
  - type: table
    name: Items
    groupBy:
      property: container
      direction: ASC
    summaries:
      quantity: Sum
```

Container note — its contents:
```yaml
filters:
  and:
    - type == "item"
    - container == this.file.asLink()
```

**All three filters above are probe-verified (P3, 2026-08-23)** and compare Links by resolved target, so
they match regardless of how the link is written — shortest form, full path, or aliased. No `asFile()`
dereference appears anywhere in the shipped templates, which also sidesteps the documented dereference
cost and the "table does not auto-refresh on linked-note change" caveat entirely.

`file.hasLink(this.file)` must **not** be used: it matches any item that merely mentions the container in
its body.

---

## 3. Phase 0 — probes (do these first)

Reuse the `probes/` pattern from `cover-image-picker`: a throwaway plugin in the test vault that
logs answers. Cheap, and each one can invalidate a design assumption.

| # | Question | Why it matters | If it fails |
|---|---|---|---|
| ~~**P1**~~ | Rename a container — do item `container:` links rewrite automatically? | The whole "no maintenance" claim rests on this. | **CLOSED 2026-08-23: yes, links rewrite on rename.** No `vault.on('rename')` fallback needed. |
| ~~**P2**~~ | `groupBy` on a link property — does the header render the note name or raw `[[…]]`? | This is problem 2. | **CLOSED 2026-08-23: renders the name.** `container_name` is dead for good — do not reintroduce it. |
| ~~**P3**~~ | Does `Link == Link` compare resolved targets or raw text? Used in the container note's contents filter and the inventory root's scoping filters. | If equality were textual, `[[Chain Box]]` and `[[Inventory/Chain Box|the box]]` would fail to match despite pointing at one file — items would silently vanish from their container. | **CLOSED 2026-08-23: equality resolves targets.** `container == this.file.asLink()` matched the alias/path-form link (`Probe Item B`). Ships as-is; no dereference needed. `file.hasLink(this.file)` eliminated — it matched the body-only Decoy, as predicted. |
| **P4** | Does the properties editor render a `container` link as clickable in both Live Preview and Reading view? | "Click the property to open the container" was an explicit requirement. | Property-row button (Phase 5) covers navigation too. |
| **P5** | Does `processFrontMatter` round-trip a `"[[Name]]"` value and register it in `frontmatterLinks`? | The write path. | Already answered yes by the cover-image-picker D2 probe (2026-08-17); re-confirm cheaply for a non-image property. |

**All blocking probes closed 2026-08-23.** P1, P2 and P3 all landed on the favourable answer, which is
what makes the link-primary model in §2 safe and keeps every filter in §2 dereference-free. Site 2
(`inventory == this.file.asLink()`) is confirmed working, and the grouped item view re-confirmed P2 with
per-container quantity sums.

P4 and P5 remain open but block nothing: P4 only decides whether the Phase 5 button also has to carry
navigation, and P5 was already answered affirmatively by the cover-image-picker D2 probe.

Probe fixtures live in `test-vault/P3 Probe/` (six notes, one view per candidate filter). `Probe Item B`
carried the alias/path-form link and was the discriminator; `Probe Decoy` linked from its body only and
exposed `file.hasLink`. **Safe to delete — P3 is closed.**

---

## 4. Architecture

Same shape as `cover-image-picker`, for the same reason: quarantine the two things most likely to
break. Here that is Obsidian's internal property DOM (F1 — still no public properties API in 1.13.1)
and the Bases filter syntax.

```
src/
  main.ts                    plugin wiring only
  core/                      pure, no obsidian import, fully unit-tested
    schema.ts                property names, note kinds, defaults
    identify.ts              classify a note from its metadata cache entry
    move.ts                  plan a move → frontmatter patch + validation result
    validate.ts              integrity scan → typed findings
    naming.ts                unique, path-safe filename for a new note
    create.ts                frontmatter + body for each new note kind
    templates.ts             the Bases blocks; filters locked by P1-P3 and
                             guarded by tests/templates.test.ts
    ids.ts                   uuid generation
    migrate.ts               legacy note → new-model patch (pure; testable on fixtures)
    errors.ts
  obsidian/
    inventory-index.ts       resolve inventories/containers/items via metadataCache
    frontmatter-port.ts      processFrontMatter + open-editor flush (ported from CIP)
    note-factory.ts          create note from template, apply patch, open
    property-dom.ts          ⚠ internal DOM — the move button (ported from CIP)
  ui/
    choice-modal.ts          one generic fuzzy picker for every "which note?"
    name-prompt.ts           title input that refuses unusable names
    confirm-modal.ts         gate for legal-but-unusual moves
    move-button.ts           the property-row affordance
    report-modal.ts          validation results
  triggers/
    commands.ts
    file-menu.ts             single and multi-select "Move to container…"
  settings/
    schema.ts  tab.ts  validate.ts
templates/                   starter item/container/inventory notes + base snippets
```

Toolchain copied from `cover-image-picker` unchanged: esbuild, vitest, eslint +
`eslint-plugin-obsidianmd`, `npm run check` = build + lint + test.

`property-dom.ts` is ported nearly verbatim — it is already written to fail soft, and it is the only
file allowed to touch internal class names. Every command must work with it absent (F11: the user
may have properties set to Hidden).

---

## 5. Commands

| Command | Behaviour |
|---|---|
| **Move item to container…** | Fuzzy modal over containers in the item's inventory; shows folder as secondary text; most-recently-used first. Works on the active note, from the `container` property row, or on a file-explorer selection. |
| **Bulk move** | File-explorer multi-selection (`files-menu`), folders expanded. Mixed selections filter rather than refuse; one confirmation for the whole batch, never one per item; writes sequentially and reports partial failure honestly. |
| **Undo last bulk move** | Session-only. Restores each item's previous container, unplacing those whose container has since been deleted. Hidden from the palette when there is nothing to undo. |
| **Create item** | Invoked from a container note → `container` pre-filled. Invoked from an inventory note → container picker. Stamps `type`, `inventory`, `id`, default tags; creates in `item_folder`; opens the note. |
| **Create container** | Same, minus `container`. |
| **Create inventory** | Scaffolds the root note with both overview bases, beside the note you were looking at, adopting that folder for its members. One-time, but it is what makes the model reproducible. |
| **Validate inventory** | Report modal: dangling `container` links, items with no container, notes missing `type` or `inventory`, containers with no items, duplicate container names. Each finding is clickable. |
| ~~**Migrate legacy inventory**~~ | **Descoped 2026-08-23** at the user's direction: the only vault holding legacy notes is the test vault, so a shipped migration command has no user. §6 records how it was done instead. |

The move command is registered before anything else — with it alone the plugin already solves the
original complaint, and it is what should be dogfooded while the rest is built.

---

## 6. Converting the test vault (done, not shipped)

Migration was **descoped as a feature**. There is no production vault on the old
uuid scheme, so a command to migrate one would have no user. The test vault was
converted once, by a throwaway script, purely to give the commands realistic data.

Applied 2026-08-23 to all 26 notes in `test-vault/Inventory`: 23 items, 2 containers,
1 inventory root. Uuid `container` values resolved to wikilinks, `type` and
`inventory` added, structural tags (`inventarek`, `item`, `container`) stripped,
the duplicated `Container: [[...]]` body line removed, `id` preserved, and the
embedded base blocks regenerated against the locked §2 filters.

Two things that bit, worth remembering if this is ever revisited:

- **Obsidian rewrites `tags: [a, b]` into a block list** as soon as the property is
  touched in the UI, so both forms coexist in one vault. A parser that handles only
  the inline form silently skips notes rather than failing loudly.
- A container had been renamed during the P1 probe, so the "wrong" link text in the
  output was in fact correct. Verify against the current vault, not against memory
  of it.

A pre-conversion backup was taken first. Any future bulk write must do the same and
must dry-run before it applies.

## 7. Risks

| Risk | Mitigation |
|---|---|
| No public properties API (F1) — the move button is internal-DOM-coupled | One quarantined adapter (`obsidian/property-dom.ts`), degrades to "no button", warns once in the console, and is switchable off in settings. Every command works without it. |
| Bases filter syntax shifts between releases | Base YAML lives in `templates/`, not in code. Fixing it is a text edit, and existing notes are unaffected. |
| ~~P1 / P2 fail~~ | Both closed favourably 2026-08-23. Links survive rename; link groupBy renders the name. |
| ~~P3: Link equality turns out to be textual~~ | Closed — equality resolves targets. `container.asFile().path == this.file.path` remains a verified fallback if the semantics ever change. |
| Migration corrupts real data | Pure core + fixture tests + mandatory dry-run + `processFrontMatter` only. Test vault first, and it is a git-tracked copy. |
| Scope creep into "inventory app" | Anything Bases can already express is out of scope. `registerBasesView` exists in 1.13.1 and a drag-and-drop board is tempting — explicitly deferred; the agreed model is what makes it cheap later. |

---

## 8. Security & robustness

- All writes via `FileManager.processFrontMatter` — atomic read-modify-write, wrapped in try/catch,
  `YAMLParseError` surfaced as a safe `Notice`, never a stack trace.
- Flush open editors (`view.save()`) before writing — `TextFileView.requestSave` is debounced 2s and
  would otherwise clobber the write (F6a, learned the hard way in cover-image-picker).
- User-supplied note names sanitized against path traversal and illegal filename characters before
  any `vault.create`; collisions resolved by `naming.ts`, never overwritten.
- Bulk operations (migrate, bulk move) require an explicit confirm after a dry-run.
- No network access, no secrets, no telemetry. Nothing to leak.

---

## 9. Sequence

| Phase | Content | Exit criterion |
|---|---|---|
| ~~**0**~~ | Probes | **Done 2026-08-23.** P1–P3 closed favourably; §2 base templates locked |
| ~~**1**~~ | Repo scaffold, toolchain, pure `core/` with tests | **Done.** `npm run check` green, 87 tests |
| ~~**2**~~ | Move command + container suggest modal | **Done.** No DOM coupling |
| ~~**3**~~ | `validate` + report modal (migrate descoped) | **Done.** Test vault converted; validation runs clean |
| ~~**4**~~ | Creation commands + inventory scaffolding | **Done.** New inventory reproducible from nothing |
| ~~**5**~~ | Property-row move button (internal DOM, optional) | **Done.** Button works; the toggle removes it with no functional loss |
| ~~**6**~~ | File-menu bulk move, settings tab, README, load smoke test | **Done.** 139 tests; `main.ts`, the DOM adapter and the file-explorer adapters are covered against a stubbed Obsidian |

Phases 2 and 3 are the ones that pay for the plugin. 5 is a convenience and can be cut.

All six phases are complete. Remaining before a public release: the community-plugin submission checklist, a demo recording, and testing on iOS - the property-row button and the pickers have only been exercised on desktop.
