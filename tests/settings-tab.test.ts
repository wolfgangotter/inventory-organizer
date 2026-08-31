/**
 * @vitest-environment jsdom
 *
 * The settings tab, driven the way Obsidian drives it: definitions in, control
 * values out. Worth testing because the two image-property fields are the only
 * settings that write into a nested structure and reject what the user typed.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import InventoryOrganizerPlugin from '../src/main';
import { InventoryOrganizerSettingTab } from '../src/settings/tab';
import { createMockApp } from './stubs/obsidian';
import { installObsidianDom } from './stubs/dom';

/** The definition shape the tab actually returns, narrowed for the assertions. */
interface Definition {
	name: string;
	visible?: boolean | (() => boolean);
	control: { key: string; validate?: (value: unknown) => string | void };
}

async function makeTab(): Promise<{
	plugin: InventoryOrganizerPlugin;
	tab: InventoryOrganizerSettingTab;
}> {
	const app = createMockApp();
	const plugin = new InventoryOrganizerPlugin(app as never, { id: 'inventory-organizer' } as never);
	(plugin as unknown as { _loaded: boolean })._loaded = true;
	await plugin.onload();
	return { plugin, tab: new InventoryOrganizerSettingTab(app as never, plugin) };
}

function definition(tab: InventoryOrganizerSettingTab, key: string): Definition {
	const found = (tab.getSettingDefinitions() as unknown as Definition[]).find(
		(item) => item.control?.key === key,
	);
	if (!found) throw new Error(`no setting for ${key}`);
	return found;
}

const isVisible = (item: Definition): boolean =>
	typeof item.visible === 'function' ? item.visible() : item.visible !== false;

beforeEach(() => {
	installObsidianDom();
});

describe('image property fields', () => {
	it('are hidden until card images are switched on', async () => {
		const { plugin, tab } = await makeTab();
		expect(isVisible(definition(tab, 'propertyNames.cover'))).toBe(false);

		await tab.setControlValue('cardImages', true);

		expect(isVisible(definition(tab, 'propertyNames.cover'))).toBe(true);
		expect(isVisible(definition(tab, 'propertyNames.banner'))).toBe(true);
		expect(plugin.settings.cardImages).toBe(true);
	});

	it('reads the configured name rather than the flat settings key', async () => {
		const { plugin, tab } = await makeTab();
		plugin.settings.propertyNames.cover = 'item_image';
		expect(tab.getControlValue('propertyNames.cover')).toBe('item_image');
		expect(tab.getControlValue('propertyNames.banner')).toBe('banner');
	});

	it('persists a renamed image property', async () => {
		const { plugin, tab } = await makeTab();
		await tab.setControlValue('propertyNames.cover', '  item_image  ');
		expect(plugin.settings.propertyNames.cover).toBe('item_image');
	});

	it('rejects a name that would break the generated Bases', async () => {
		const { plugin, tab } = await makeTab();
		const validate = definition(tab, 'propertyNames.cover').control.validate;

		expect(validate?.('item image')).toBeTruthy();
		expect(validate?.('item-image')).toBeTruthy();
		expect(validate?.('')).toBeTruthy();
		expect(validate?.('item_image')).toBeUndefined();

		// And the write refuses it too, so a validate that never ran cannot let
		// a broken name through to a note.
		await tab.setControlValue('propertyNames.cover', 'item image');
		expect(plugin.settings.propertyNames.cover).toBe('cover');
	});

	it('refuses a name another property already holds', async () => {
		const { plugin, tab } = await makeTab();
		const validate = definition(tab, 'propertyNames.cover').control.validate;

		expect(validate?.('container')).toBeTruthy();
		// `tags` is written on every created note as well, so it is taken too.
		expect(validate?.('tags')).toBeTruthy();

		await tab.setControlValue('propertyNames.cover', 'banner');
		expect(plugin.settings.propertyNames.cover).toBe('cover');
	});

	it('accepts the name it already has', async () => {
		const { tab } = await makeTab();
		expect(definition(tab, 'propertyNames.cover').control.validate?.('cover')).toBeUndefined();
	});
});
