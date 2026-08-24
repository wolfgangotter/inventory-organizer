# Release checklist

Follows `implementation-plan.md`, all six phases of which are complete. §1 is
done; §2 and §3 need a GitHub repository and your explicit go-ahead, because
they are public and effectively irreversible.

---

## 1. Repository state — done

- [x] `LICENSE` carries the right copyright holder — Wolfgang Otter, 2026. (Worth
      re-checking on any future plugin: the sample plugin ships with "Dynalist
      Inc." and that is a genuine blocker, since it misattributes the work.)
- [x] `manifest.json`: stable `id` (`inventory-organizer` — **never change this
      after release**), `minAppVersion` `1.13.0`, `isDesktopOnly: false`
- [x] `package.json` version matches the manifest
- [x] `main.js` is gitignored; CI builds it for the release
- [x] CI runs typecheck, lint **and** the test suite on Node 20/22/24
- [x] README states the model, the commands, the properties and the design
      decisions behind them
- [x] Quality gate clean: `npm run check` — typecheck + lint + 139 tests, zero
      errors **and** zero warnings

## 2. Before tagging

- [ ] **Bump to `1.0.0`.** Currently `0.1.0`. Use `npm version major`, which runs
      `version-bump.mjs` and keeps `manifest.json` and `versions.json` in step.
      Do not hand-edit the three files.
- [ ] **Check `inventory-organizer` is free** in the community catalogue. Both
      the `id` and the `name` must be unique, and "inventory" is a plausible
      collision. Check against `community-plugins.json` in
      `obsidianmd/obsidian-releases`, and glance at any near neighbours so the
      README differentiates.
- [ ] **Create `main`.** All history is currently on
      `feat/inventory-organizer-core` and no `main` exists. The release workflow
      and the community directory both assume a default branch.
- [ ] **Add a screenshot** to the README — ideally the container picker over a
      real inventory, and a grouped Bases view showing container names. The
      catalogue listing is much weaker without one, and the grouped view is the
      single clearest argument for the whole design.
- [ ] **Run the manual matrix below.**
- [ ] Push to a public GitHub repository.

### Manual matrix

Be honest about this table. Almost nothing has been exercised by hand yet: the
plugin was built against a converted test vault and a probe, and a first release
is the wrong time to discover a platform difference.

| Case                                                                  | Status                                     |
| --------------------------------------------------------------------- | ------------------------------------------ |
| Bases: link equality resolves across link forms (P1–P3)               | ✅ probe-verified 2026-08-23               |
| Bases: `groupBy: container` renders the container name                | ✅ probe-verified 2026-08-23               |
| Rename a container — every item's link follows                        | ✅ probe-verified 2026-08-23               |
| Desktop: move an item via the command palette                         | ⬜                                         |
| Desktop: move via the container property button, placed and unplaced  | ⬜                                         |
| Desktop: create inventory → container → item, end to end              | ⬜                                         |
| Create item from inside a container — container pre-filled, no picker | ⬜                                         |
| Bulk move: several notes, folder, and a mixed selection               | ⬜                                         |
| Bulk move: undo, including after deleting the original container      | ⬜                                         |
| Cross-inventory move — confirm appears, and respects the setting      | ⬜                                         |
| Validate: each finding type, and every row opens its note             | ⬜                                         |
| Properties set to `Hidden`/`Source` in Obsidian settings              | ⬜ — commands must be fully sufficient     |
| Popout window (desktop) — button appears, and is cleaned up           | ⬜                                         |
| iOS / iPadOS: every command, and the property button                  | ⬜                                         |
| Renamed properties (`type`, `container`) via settings                 | ⬜ unit-tested only                        |
| Type in a note, then move it within ~2s — nothing typed is lost       | ⬜ — the flush path, see below             |
| Disable/enable: no stray buttons left behind                          | ✅ automated (`tests/plugin-load.test.ts`) |
| Unreadable `data.json` falls back to defaults                         | ✅ automated (`tests/plugin-load.test.ts`) |

**On the flush row:** `FrontmatterWriter` calls `view.save()` before every write
because `requestSave` is debounced by two seconds while `processFrontMatter`
works on disk. Nothing automated can reach that race — it needs a real editor
with pending edits. It is also the failure that would lose a user's work, so it
is the one row worth doing carefully.

**On the iOS rows:** the property button carries two defensive details inherited
from cover-image-picker — never `preventDefault` on `touchstart`, and a 44px
touch target — but neither has been exercised on a device _here_.

## 3. Release and submission

Submission is **not** a pull request against `obsidianmd/obsidian-releases`. It
goes through the community directory web interface. (Confirmed 2026-08-24.)

1. **Push to a public GitHub repository**, with `main` as the default branch.
   The directory reads `manifest.json` from the default branch, and the repo must
   be publicly readable for review.
2. **Tag exactly `1.0.0`** — no leading `v`. The tag must equal the manifest
   version or the automated check fails.
    ```bash
    git tag 1.0.0 && git push origin 1.0.0
    ```
3. The release workflow builds and opens a **draft** release with `main.js`,
   `manifest.json` and `styles.css` attached as individual files. Review it and
   **publish** it — a draft is invisible to the directory.
4. **Submit** at <https://community.obsidian.md>: sign in with your Obsidian
   account, link GitHub so ownership can be verified, and add the plugin.
5. **Address feedback.** Review is automated first. Fixes require a new release
   with an incremented version — `1.0.0` cannot be amended in place once
   submitted.

## 4. After release

- Never change the plugin `id`.
- Bump with `npm version <patch|minor|major>`; `version-bump.mjs` keeps
  `manifest.json` and `versions.json` in step.
- `minAppVersion` only moves up when a newer API is actually used. It is at
  1.13.0 because of the declarative settings API and Bases link semantics — both
  genuinely require it.
- The `id` property on items and containers is a durable external key that
  nothing reads. If a future version ever filters on it, that is a regression:
  see the design notes in the README and `tests/templates.test.ts`.
