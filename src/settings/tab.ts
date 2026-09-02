import { PluginSettingTab, type App, type SettingDefinitionItem } from 'obsidian';
import { DEFAULT_PROPERTY_NAMES, propertyNameProblem, type PropertyNames } from '../core/schema';
import { takenNames } from './validate';
import type InventoryOrganizerPlugin from '../main';

/** The boolean settings the tab exposes, and where each one lives. */
const TOGGLES = ['showPropertyButton', 'warnCrossInventory', 'cardImages', 'suggestFolders'] as const;
type ToggleKey = (typeof TOGGLES)[number];

/**
 * The property names the tab lets the user edit, keyed by the control key.
 *
 * Only the two image properties are here. `type`, `inventory`, `container` and
 * `id` are configurable too, but renaming one orphans every note already
 * carrying the old name - that is a migration, not a setting, and it stays in
 * `data.json` where nobody arrives by accident.
 */
const NAME_CONTROLS = {
	'propertyNames.cover': 'cover',
	'propertyNames.banner': 'banner',
} as const satisfies Record<string, keyof PropertyNames>;

type NameControlKey = keyof typeof NAME_CONTROLS;

function isToggleKey(key: string): key is ToggleKey {
	return (TOGGLES as readonly string[]).includes(key);
}

function isNameControlKey(key: string): key is NameControlKey {
	return key in NAME_CONTROLS;
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
				name: 'Folder autocomplete',
				desc:
					'Suggests folders while you type in an inventory’s item folder and container ' +
					'folder properties. Built on Obsidian’s internal layout like the button above, ' +
					'so it can stop working after an update — the “Set item folder” and “Set ' +
					'container folder” commands never depend on it.',
				aliases: ['folder', 'autocomplete', 'suggest', 'path'],
				control: { type: 'toggle', key: 'suggestFolders' },
			},
			{
				name: 'Card images',
				desc:
					'Bind an image property as the card image in the Bases views new notes are created ' +
					'with, and seed that property empty so there is a row to drop a picture onto. ' +
					'Applies to notes created from then on.',
				aliases: ['cover', 'banner', 'image', 'card'],
				control: { type: 'toggle', key: 'cardImages' },
			},
			this.nameSetting('propertyNames.cover', {
				name: 'Item image property',
				desc: 'Frontmatter property holding an item’s card image.',
				aliases: ['cover', 'item', 'image', 'property'],
			}),
			this.nameSetting('propertyNames.banner', {
				name: 'Container image property',
				desc: 'Frontmatter property holding a container’s card image.',
				aliases: ['banner', 'container', 'image', 'property'],
			}),
			{
				name: 'Confirm moves between inventories',
				desc: 'Ask before moving an item into a container that belongs to another inventory.',
				aliases: ['cross', 'inventory', 'confirm'],
				control: { type: 'toggle', key: 'warnCrossInventory' },
			},
		];
	}

	/**
	 * One of the two image-property fields.
	 *
	 * Hidden unless card images are on, because that is the only thing the name
	 * feeds: with the setting off, neither the seeded property nor the view
	 * binding is written and the field would be asking about nothing.
	 */
	private nameSetting(
		key: NameControlKey,
		labels: { name: string; desc: string; aliases: string[] },
	): SettingDefinitionItem {
		const property = NAME_CONTROLS[key];
		return {
			...labels,
			visible: () => this.plugin.settings.cardImages,
			control: {
				type: 'text',
				key,
				placeholder: DEFAULT_PROPERTY_NAMES[property],
				defaultValue: DEFAULT_PROPERTY_NAMES[property],
				// Rejected before it is persisted, so a name that would break the
				// generated Bases never reaches a note. `validateSettings` checks
				// again on load, for a `data.json` that never came through here.
				validate: (value) => this.nameProblem(property, value) ?? undefined,
			},
		};
	}

	/** Why `value` cannot name `property`, in words meant for the field. */
	private nameProblem(property: keyof PropertyNames, value: unknown): string | null {
		if (typeof value !== 'string') return 'Enter a property name.';
		return propertyNameProblem(value.trim(), takenNames(this.plugin.settings.propertyNames, property));
	}

	override getControlValue(key: string): unknown {
		if (isNameControlKey(key)) return this.plugin.settings.propertyNames[NAME_CONTROLS[key]];
		return super.getControlValue(key);
	}

	/**
	 * Routed through `saveSettings` rather than mutating and persisting directly,
	 * so the property-row adapter re-syncs with the new value. The base
	 * implementation would write the setting without telling anything about it.
	 */
	override async setControlValue(key: string, value: unknown): Promise<void> {
		if (isNameControlKey(key)) {
			// Re-checked rather than trusted: `validate` is the field's guard, and
			// nothing guarantees it ran on the value that arrives here.
			const property = NAME_CONTROLS[key];
			if (typeof value !== 'string' || this.nameProblem(property, value)) return;
			this.plugin.settings.propertyNames[property] = value.trim();
			await this.plugin.saveSettings();
			return;
		}

		if (!isToggleKey(key) || typeof value !== 'boolean') return;
		this.plugin.settings[key] = value;
		await this.plugin.saveSettings();
		// The two image-property fields appear and disappear with this toggle.
		if (key === 'cardImages') this.update();
	}
}
