/**
 * @vitest-environment jsdom
 *
 * Load smoke test.
 *
 * "Failed to load plugin" is the worst thing this plugin could ship, and no
 * other test can see it: every unit test imports pure modules that never run
 * onload. This walks the real wiring in main.ts against a stubbed Obsidian.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InventoryOrganizerPlugin from '../src/main';
import { createMockApp, type MockApp } from './stubs/obsidian';
import { installObsidianDom } from './stubs/dom';

/** The stub Plugin records these; the real `Plugin` type does not expose them. */
interface Recorded {
	commands: { id: string; name: string }[];
	settingTabs: { getSettingDefinitions: () => { control: { key: string } }[] }[];
	failLoad: boolean;
}
const recorded = (plugin: InventoryOrganizerPlugin) => plugin as unknown as Recorded;

function makePlugin(): InventoryOrganizerPlugin {
	const app: MockApp = createMockApp();
	const plugin = new InventoryOrganizerPlugin(app as never, { id: 'inventory-organizer' } as never);
	// Obsidian calls onload() on an already-loaded Component, so addChild()
	// loads its children immediately. Without this the child onloads - where all
	// the DOM work lives - would silently never run in the test.
	(plugin as unknown as { _loaded: boolean })._loaded = true;
	return plugin;
}

beforeEach(() => {
	installObsidianDom();
});

describe('plugin load', () => {
	it('loads without throwing', async () => {
		await expect(makePlugin().onload()).resolves.not.toThrow();
	});

	it('registers every command', async () => {
		const plugin = makePlugin();
		await plugin.onload();
		expect(
			recorded(plugin)
				.commands.map((c) => c.id)
				.sort(),
		).toEqual([
			'create-container',
			'create-inventory',
			'create-item',
			'move-item-to-container',
			'undo-last-bulk-move',
			'validate-inventory',
		]);
	});

	it('exposes its settings to Obsidian’s settings search', async () => {
		const plugin = makePlugin();
		await plugin.onload();
		const tab = recorded(plugin).settingTabs[0];
		// By key rather than by count, so adding a setting does not fail a test
		// that is really about the definitions being reachable at all.
		const keys = (tab?.getSettingDefinitions() ?? []).map((definition) => definition.control.key);
		expect(keys.sort()).toEqual([
			'cardImages',
			'propertyNames.banner',
			'propertyNames.cover',
			'showPropertyButton',
			'warnCrossInventory',
		]);
	});

	it('falls back to defaults when data.json cannot be read', async () => {
		// A synced or half-copied vault can leave invalid JSON behind, and
		// failing the load over a settings file would take the commands with it.
		// The plugin reports this to the console on purpose; silenced here so a
		// passing run stays quiet.
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
		const plugin = makePlugin();
		recorded(plugin).failLoad = true;

		await expect(plugin.onload()).resolves.not.toThrow();

		expect(plugin.settings.propertyNames.container).toBe('container');
		expect(logged).toHaveBeenCalled();
	});

	it('hides the undo command until there is something to undo', async () => {
		const plugin = makePlugin();
		await plugin.onload();
		const undo = recorded(plugin).commands.find((c) => c.id === 'undo-last-bulk-move');
		const check = (undo as unknown as { checkCallback: (checking: boolean) => boolean }).checkCallback;
		expect(check(true)).toBe(false);

		plugin.lastBulkMove = { targetName: 'Chain Box', entries: [] };
		expect(check(true)).toBe(true);
	});

	it('unloads cleanly', async () => {
		const plugin = makePlugin();
		await plugin.onload();
		expect(() => plugin.unload()).not.toThrow();
	});

	it('leaves no move buttons behind after unload', async () => {
		const plugin = makePlugin();
		await plugin.onload();
		plugin.unload();
		expect(document.querySelectorAll('.io-move-button')).toHaveLength(0);
	});
});
