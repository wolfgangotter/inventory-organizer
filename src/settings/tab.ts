import { PluginSettingTab, type App, type SettingDefinitionItem } from 'obsidian';
import type InventoryOrganizerPlugin from '../main';

/** The boolean settings the tab exposes, and where each one lives. */
const TOGGLES = ['showPropertyButton', 'warnCrossInventory', 'cardImages'] as const;
type ToggleKey = (typeof TOGGLES)[number];

function isToggleKey(key: string): key is ToggleKey {
	return (TOGGLES as readonly string[]).includes(key);
}

/**
 * Declarative settings (1.13+), so every option is reachable from Obsidian's
 * settings search rather than only by finding this tab.
 */
export class InventoryOrganizerSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: InventoryOrganizerPlugin,
	) {
		super(app, plugin);
	}

	override getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: 'Button on the container property',
				desc:
					'Adds a button to an item’s container property for moving it. This is the one ' +
					'feature built on Obsidian’s internal layout, so it can stop working after an ' +
					'update — the commands never depend on it.',
				aliases: ['move', 'property', 'button'],
				control: { type: 'toggle', key: 'showPropertyButton' },
			},
			{
				name: 'Card images',
				desc:
					'Bind `cover` on items and `banner` on containers as the card image in the Bases ' +
					'views new notes are created with, and seed the matching empty property so there ' +
					'is a row to drop a picture onto. Applies to notes created from then on.',
				aliases: ['cover', 'banner', 'image', 'card'],
				control: { type: 'toggle', key: 'cardImages' },
			},
			{
				name: 'Confirm moves between inventories',
				desc: 'Ask before moving an item into a container that belongs to another inventory.',
				aliases: ['cross', 'inventory', 'confirm'],
				control: { type: 'toggle', key: 'warnCrossInventory' },
			},
		];
	}

	/**
	 * Routed through `saveSettings` rather than mutating and persisting directly,
	 * so the property-row adapter re-syncs with the new value. The base
	 * implementation would write the setting without telling anything about it.
	 */
	override async setControlValue(key: string, value: unknown): Promise<void> {
		if (!isToggleKey(key) || typeof value !== 'boolean') return;
		this.plugin.settings[key] = value;
		await this.plugin.saveSettings();
	}
}
