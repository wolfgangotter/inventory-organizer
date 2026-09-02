/**
 * @vitest-environment jsdom
 *
 * Folder autocomplete, driven through the real adapter against a stubbed
 * property editor.
 *
 * This is the internal-DOM half of the feature, so what matters is not that
 * suggestions are ranked well - `folders.test.ts` covers that - but that a
 * suggester lands on exactly the rows it should, on exactly the notes it
 * should, and is gone again afterwards.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import InventoryOrganizerPlugin from '../src/main';
import { INVENTORY_CONFIG_KEYS } from '../src/core/schema';
import { createMockApp, makeFile, makeFolder, MarkdownView, type MockApp } from './stubs/obsidian';
import { installObsidianDom, makePropertyRow } from './stubs/dom';

const VAULT_FOLDERS = ['Films', 'Films/Genres', 'Films/Genres/Individual Movies', 'Archive'];

/** The adapter's private map of attached suggesters, by element. */
interface Suggest {
	textInputEl: HTMLElement;
	getSuggestions: (query: string) => string[];
}
function attached(plugin: InventoryOrganizerPlugin): Map<HTMLElement, Suggest> {
	return (plugin as unknown as { propertyDom: { suggests: Map<HTMLElement, Suggest> } }).propertyDom
		.suggests;
}

/** The one suggester attached to `key`'s row, or a failure naming the row. */
function suggestFor(plugin: InventoryOrganizerPlugin, key: string): Suggest {
	for (const [element, suggest] of attached(plugin)) {
		if (element.closest('.metadata-property')?.getAttribute('data-property-key') === key) {
			return suggest;
		}
	}
	throw new Error(`no suggester on the ${key} row`);
}

/** Which property keys ended up with a suggester on them. */
function suggestedKeys(plugin: InventoryOrganizerPlugin): string[] {
	return [...attached(plugin).keys()]
		.map((el) => el.closest('.metadata-property')?.getAttribute('data-property-key') ?? '?')
		.sort();
}

interface Fixture {
	plugin: InventoryOrganizerPlugin;
	app: MockApp;
	rows: Record<string, HTMLElement>;
}

/**
 * A plugin loaded with one open note showing three property rows.
 *
 * The mock's `onLayoutReady` fires its callback synchronously, so everything
 * has to be in place before `onload` - by the time it returns, the adapter has
 * already made its first sweep.
 */
async function load(
	options: { kind?: string; noteName?: string; settings?: Record<string, unknown> } = {},
): Promise<Fixture> {
	const app = createMockApp();
	const file = makeFile(options.noteName ?? 'Films/Films.md');

	// A Text property renders as a contenteditable div and a list as an input;
	// the suggester has to find the first and ignore the third either way.
	const rows: Record<string, HTMLElement> = {
		[INVENTORY_CONFIG_KEYS.itemFolder]: makePropertyRow(
			INVENTORY_CONFIG_KEYS.itemFolder,
			'contenteditable',
		),
		[INVENTORY_CONFIG_KEYS.containerFolder]: makePropertyRow(INVENTORY_CONFIG_KEYS.containerFolder),
		default_tags: makePropertyRow('default_tags', 'contenteditable'),
	};

	const view = new MarkdownView();
	view.file = file;
	const container = document.createElement('div');
	container.className = 'metadata-container';
	view.contentEl.appendChild(container);
	for (const row of Object.values(rows)) container.appendChild(row);
	// Popout-safe cleanup sweeps `activeDocument`, so the view has to be in it.
	document.body.appendChild(view.contentEl);

	app.workspace.getLeavesOfType = () => [{ view }];
	app.metadataCache.getFileCache = () =>
		({ frontmatter: { type: options.kind ?? 'inventory' } }) as never;
	app.vault.getAllFolders = () => VAULT_FOLDERS.map((path) => makeFolder(path));

	const plugin = new InventoryOrganizerPlugin(app as never, { id: 'inventory-organizer' } as never);
	(plugin as unknown as { _loaded: boolean })._loaded = true;
	await plugin.onload();
	if (options.settings) {
		Object.assign(plugin.settings, options.settings);
		plugin.refreshPropertyRows();
	}
	return { plugin, app, rows };
}

beforeEach(() => {
	installObsidianDom();
	document.body.replaceChildren();
});

describe('folder autocomplete', () => {
	it('attaches to both folder rows of an inventory note', async () => {
		const { plugin } = await load();
		expect(suggestedKeys(plugin)).toEqual(['container_folder', 'item_folder']);
	});

	it('leaves every other property row alone', async () => {
		const { plugin, rows } = await load();
		const other = rows.default_tags?.querySelector('[contenteditable="true"]');
		expect(attached(plugin).has(other as HTMLElement)).toBe(false);
	});

	it('attaches to the row’s input, not the row', async () => {
		// A Text property is a contenteditable div and a list is an input; both
		// are shapes `AbstractInputSuggest` takes, and both have to be found.
		const { plugin, rows } = await load();
		const editable = rows[INVENTORY_CONFIG_KEYS.itemFolder]?.querySelector(
			'[contenteditable="true"]',
		);
		const input = rows[INVENTORY_CONFIG_KEYS.containerFolder]?.querySelector('input');
		expect(attached(plugin).has(editable as HTMLElement)).toBe(true);
		expect(attached(plugin).has(input as HTMLElement)).toBe(true);
	});

	it('ignores the same property names on a note that is not an inventory', async () => {
		// `item_folder` only means anything on an inventory root; a note that
		// happens to carry the name is none of our business.
		const { plugin } = await load({ kind: 'item' });
		expect(attached(plugin).size).toBe(0);
	});

	it('attaches nothing while the setting is off', async () => {
		const { plugin } = await load({ settings: { suggestFolders: false } });
		expect(attached(plugin).size).toBe(0);
	});

	it('detaches when the setting is switched off', async () => {
		const { plugin } = await load();
		expect(attached(plugin).size).toBe(2);

		plugin.settings.suggestFolders = false;
		plugin.refreshPropertyRows();

		expect(attached(plugin).size).toBe(0);
	});

	it('never stacks a second suggester on the same field', async () => {
		const { plugin } = await load();
		// Several sweeps is the normal case: every keystroke in the note can
		// trigger one, and the button beside it is rebuilt on each.
		plugin.settings.showPropertyButton = false;
		plugin.refreshPropertyRows();
		plugin.settings.showPropertyButton = true;
		plugin.refreshPropertyRows();

		expect(attached(plugin).size).toBe(2);
	});

	it('offers the inventory’s own folder first', async () => {
		const { plugin } = await load();
		const suggest = suggestFor(plugin, INVENTORY_CONFIG_KEYS.itemFolder);
		expect(suggest.getSuggestions('')).toEqual([
			'Films',
			'Films/Genres',
			'Films/Genres/Individual Movies',
			'Archive',
		]);
		expect(suggest.getSuggestions('gen')).toEqual([
			'Films/Genres',
			'Films/Genres/Individual Movies',
		]);
	});

	it('ranks against the vault root for an inventory sitting there', async () => {
		const { plugin } = await load({ noteName: 'Films.md' });
		const suggest = suggestFor(plugin, INVENTORY_CONFIG_KEYS.itemFolder);
		// Nothing is local, so match quality alone decides.
		expect(suggest.getSuggestions('archiv')).toEqual(['Archive']);
	});

	it('leaves nothing attached after unload', async () => {
		const { plugin } = await load();
		plugin.unload();
		expect(attached(plugin).size).toBe(0);
	});
});
