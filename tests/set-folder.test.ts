/**
 * @vitest-environment jsdom
 *
 * The commands behind folder autocomplete.
 *
 * These are the reason the suggester is allowed to be built on internal DOM at
 * all: when the markup changes and the dropdown stops appearing, this is what
 * still sets the two folders. So they are tested against the frontmatter they
 * actually write, not just for not throwing.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InventoryOrganizerPlugin from '../src/main';
import { applyFolder, vaultFolders } from '../src/triggers/set-folder';
import type { InventoryNote } from '../src/core/schema';
import { createMockApp, makeFile, makeFolder, Notice, type MockApp } from './stubs/obsidian';
import { installObsidianDom } from './stubs/dom';

const inventory: InventoryNote = {
	ref: { path: 'Films/Films.md', basename: 'Films' },
	kind: 'inventory',
	inventoryPath: null,
	inventoryDangling: false,
	containerPath: null,
	containerDangling: false,
	id: null,
};

async function load(): Promise<{ plugin: InventoryOrganizerPlugin; app: MockApp }> {
	const app = createMockApp();
	const file = makeFile('Films/Films.md');
	app.vault.getFileByPath = (path) => (path === file.path ? file : null);
	app.vault.getAllFolders = () =>
		['Films', 'Films/Genres', 'Archive'].map((path) => makeFolder(path));

	const plugin = new InventoryOrganizerPlugin(app as never, { id: 'inventory-organizer' } as never);
	(plugin as unknown as { _loaded: boolean })._loaded = true;
	await plugin.onload();
	return { plugin, app };
}

beforeEach(() => {
	installObsidianDom();
	Notice.last = null;
});

describe('vaultFolders', () => {
	it('lists the vault’s folders as plain paths', async () => {
		const { plugin } = await load();
		expect(vaultFolders(plugin)).toEqual(['Films', 'Films/Genres', 'Archive']);
	});

	it('leaves the vault root out, because it cannot be expressed', async () => {
		// An empty `item_folder` reads as "no preference" and falls back to the
		// inventory's own folder, so a row for the root would not do what it says.
		const { plugin, app } = await load();
		app.vault.getAllFolders = () => [makeFolder('')];
		expect(vaultFolders(plugin)).not.toContain('/');
	});
});

describe('applyFolder', () => {
	it('writes the chosen folder', async () => {
		const { plugin, app } = await load();
		await applyFolder(plugin, inventory, 'item', 'Films/Genres');
		expect(app.fileManager.frontmatter.item_folder).toBe('Films/Genres');
	});

	it('writes each kind to its own key', async () => {
		const { plugin, app } = await load();
		await applyFolder(plugin, inventory, 'container', 'Archive');
		expect(app.fileManager.frontmatter.container_folder).toBe('Archive');
		expect(app.fileManager.frontmatter).not.toHaveProperty('item_folder');
	});

	it('removes the key for "beside the inventory note"', async () => {
		// Clearing it is how that is expressed - and it keeps following the note
		// if the inventory is ever moved, which a written-out path would not.
		const { plugin, app } = await load();
		app.fileManager.frontmatter.item_folder = 'Somewhere';

		await applyFolder(plugin, inventory, 'item', null);

		expect(app.fileManager.frontmatter).not.toHaveProperty('item_folder');
	});

	it('reports a note that has since been deleted', async () => {
		const { plugin, app } = await load();
		app.vault.getFileByPath = () => null;

		await applyFolder(plugin, inventory, 'item', 'Films/Genres');

		expect(Notice.last).toContain('no longer exists');
	});

	it('reports a failed write instead of throwing', async () => {
		// Broken YAML in the note makes processFrontMatter throw; the user gets a
		// notice, the cause goes to the console, and the command does not blow up.
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { plugin, app } = await load();
		app.fileManager.processFrontMatter = () => Promise.reject(new Error('YAMLParseError'));

		await expect(applyFolder(plugin, inventory, 'item', 'Films/Genres')).resolves.toBeUndefined();

		expect(Notice.last).toContain('could not be saved');
		expect(logged).toHaveBeenCalled();
		vi.restoreAllMocks();
	});
});
