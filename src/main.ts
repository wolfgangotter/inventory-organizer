import { Notice, Plugin } from 'obsidian';
import { InventoryIndex } from './obsidian/inventory-index';
import { FrontmatterWriter } from './obsidian/frontmatter-port';
import { NoteFactory } from './obsidian/note-factory';
import { PropertyDomAdapter } from './obsidian/property-dom';
import {
	DEFAULT_SETTINGS,
	MAX_RECENT_CONTAINERS,
	type InventoryOrganizerSettings,
} from './settings/schema';
import { InventoryOrganizerSettingTab } from './settings/tab';
import { validateSettings } from './settings/validate';
import { withRecent } from './core/recent';
import type { BulkUndo } from './triggers/bulk-move';
import { registerCommands } from './triggers/commands';
import { registerFileMenu } from './triggers/file-menu';

export default class InventoryOrganizerPlugin extends Plugin {
	settings: InventoryOrganizerSettings = DEFAULT_SETTINGS;
	index!: InventoryIndex;
	frontmatter!: FrontmatterWriter;
	notes!: NoteFactory;
	private propertyDom!: PropertyDomAdapter;
	/**
	 * The last bulk move, for the undo command.
	 *
	 * Session-only and never persisted: offering to undo a move from a previous
	 * run means acting on a vault this plugin has no reason to believe it still
	 * understands.
	 */
	lastBulkMove: BulkUndo | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.index = new InventoryIndex(this.app, () => this.settings.propertyNames);
		this.frontmatter = new FrontmatterWriter(this.app);
		this.notes = new NoteFactory(this.app, this.frontmatter);

		// Reads Obsidian's internal property DOM and degrades to a no-op if it
		// changes. The commands touch none of this.
		this.propertyDom = this.addChild(new PropertyDomAdapter(this));

		registerCommands(this);
		registerFileMenu(this);
		this.addSettingTab(new InventoryOrganizerSettingTab(this.app, this));
	}

	/**
	 * `validateSettings` copes with any *shape* of stored data, but `loadData`
	 * itself throws when `data.json` is not valid JSON at all - which a synced
	 * or half-copied vault can easily produce. Failing the whole plugin load
	 * over a settings file would take the commands with it.
	 */
	async loadSettings(): Promise<void> {
		let stored: unknown;
		try {
			stored = await this.loadData();
		} catch (err) {
			console.error('[inventory-organizer] data.json could not be read; using defaults', err);
			new Notice('Inventory organizer settings were unreadable, so defaults are in use.');
			stored = undefined;
		}
		this.settings = validateSettings(stored);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.refreshPropertyRows();
	}

	/** Re-syncs the property-row button with the current settings. */
	refreshPropertyRows(): void {
		this.propertyDom.refresh();
	}

	/** Keeps the most-used containers at the top of the picker. */
	async rememberContainer(path: string): Promise<void> {
		this.settings.recentContainers = withRecent(
			this.settings.recentContainers,
			path,
			MAX_RECENT_CONTAINERS,
		);
		await this.saveSettings();
	}
}
