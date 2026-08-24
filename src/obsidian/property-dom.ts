/**
 * ⚠ THE ONLY FILE THAT DEPENDS ON OBSIDIAN'S INTERNAL DOM.
 *
 * There is no public API for the properties editor - no `registerPropertyWidget`,
 * nothing - so the inline button has to be attached by observing rendered
 * markup. Everything here fails soft: if the structure changes, the button
 * silently does not appear and every command, which needs none of this, keeps
 * working.
 *
 * Structure relied upon, as of Obsidian 1.13:
 *   .metadata-container
 *     .metadata-property[data-property-key="container"]
 *       .metadata-property-key
 *       .metadata-property-value
 */

import { Component, MarkdownView, debounce, TFile, type App } from 'obsidian';
import { BUTTON_CLASS, createMoveButton, type ButtonTarget } from '../ui/move-button';
import type InventoryOrganizerPlugin from '../main';

const PROPERTY_ROW = '.metadata-property';
const METADATA_CONTAINER = '.metadata-container';
const KEY_ATTRIBUTE = 'data-property-key';
const VALUE_CELL = '.metadata-property-value';
const RESCAN_DELAY_MS = 150;

/** Key of a property row, tolerating the attribute living on a descendant. */
export function propertyKeyOf(row: HTMLElement): string | null {
	const own = row.getAttribute(KEY_ATTRIBUTE);
	if (own) return own;
	const nested = row.querySelector(`[${KEY_ATTRIBUTE}]`);
	return nested?.getAttribute(KEY_ATTRIBUTE) ?? null;
}

export class PropertyDomAdapter extends Component {
	private observer: MutationObserver | null = null;
	private warned = false;
	/** What the current decorations were built from, so refresh can no-op. */
	private signature = '';

	constructor(private readonly plugin: InventoryOrganizerPlugin) {
		super();
	}

	private get app(): App {
		return this.plugin.app;
	}

	/**
	 * Best-effort throughout. This adapter is the one part of the plugin coupled
	 * to Obsidian's internals, so it must degrade to "no inline button" rather
	 * than take the plugin down with it - a throw in onload shows the user
	 * "failed to load plugin" and costs them the commands too.
	 */
	override onload(): void {
		try {
			const rescan = debounce(() => this.safeDecorateAll(), RESCAN_DELAY_MS, true);

			/*
			 * Observed once at the workspace root rather than per view, but
			 * mutations that cannot have touched a property row are ignored.
			 * Typing mutates the editor constantly, and every pause would
			 * otherwise cost a full sweep of every open note to discover that
			 * nothing changed.
			 *
			 * The workspace events below force a rescan anyway, so a filter that
			 * is too strict degrades to "decorated a moment later", never to
			 * "never decorated".
			 */
			this.observer = new MutationObserver((records) => {
				if (touchesProperties(records)) rescan();
			});
			this.observer.observe(this.app.workspace.containerEl, { childList: true, subtree: true });

			this.registerEvent(this.app.workspace.on('layout-change', () => rescan()));
			this.registerEvent(this.app.workspace.on('active-leaf-change', () => rescan()));
			this.registerEvent(this.app.workspace.on('file-open', () => rescan()));
			// A note becoming an item, or its container changing, both alter
			// whether and how the row should be decorated.
			this.registerEvent(this.app.metadataCache.on('changed', () => rescan()));

			this.signature = this.decorationSignature();
			this.app.workspace.onLayoutReady(() => this.safeDecorateAll());
		} catch (err) {
			console.error('[inventory-organizer] property row integration unavailable', err);
		}
	}

	override onunload(): void {
		this.observer?.disconnect();
		this.observer = null;
		this.removeAll();
	}

	/** Never lets a DOM surprise escape into Obsidian's event loop. */
	private safeDecorateAll(): void {
		try {
			this.decorateAll();
		} catch (err) {
			if (!this.warned) {
				this.warned = true;
				console.error('[inventory-organizer] could not decorate property rows', err);
			}
		}
	}

	/** Called when settings change; rebuilds only when something relevant moved. */
	refresh(): void {
		const next = this.decorationSignature();
		if (next === this.signature) return;
		this.signature = next;
		this.removeAll();
		this.safeDecorateAll();
	}

	private decorationSignature(): string {
		const settings = this.plugin.settings;
		return JSON.stringify([settings.showPropertyButton, settings.propertyNames.container]);
	}

	/**
	 * Sweeps every open markdown view as well as the active document, so buttons
	 * in popout windows are cleaned up too - those live in a different document
	 * and `activeDocument` alone would miss them.
	 */
	private removeAll(): void {
		const roots: ParentNode[] = [activeDocument];
		for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
			if (leaf.view instanceof MarkdownView) roots.push(leaf.view.contentEl);
		}
		for (const root of roots) {
			root.querySelectorAll(`.${BUTTON_CLASS}`).forEach((el) => {
				el.remove();
			});
		}
	}

	private decorateAll(): void {
		if (!this.plugin.settings.showPropertyButton) {
			this.removeAll();
			return;
		}

		for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
			const view = leaf.view;
			if (!(view instanceof MarkdownView) || !(view.file instanceof TFile)) continue;

			const rows = view.contentEl.querySelectorAll(PROPERTY_ROW);
			if (rows.length === 0) continue;

			// Decorating a row means asking whether the note is an item, so the
			// answer is fetched once per view rather than once per row.
			const isItem = this.plugin.index.noteFor(view.file).kind === 'item';
			const notePath = view.file.path;

			rows.forEach((node) => {
				if (node.instanceOf(HTMLElement)) this.decorateRow(node, notePath, isItem);
			});
		}
		this.warnOnceIfStructureMissing();
	}

	private decorateRow(row: HTMLElement, notePath: string, isItem: boolean): void {
		const key = propertyKeyOf(row);
		const wanted = this.plugin.settings.propertyNames.container;
		const existing = row.querySelector(`.${BUTTON_CLASS}`);

		// Settings may have changed since this row was decorated, or Obsidian may
		// have reused the node for a different property.
		if (!isItem || key !== wanted) {
			existing?.remove();
			return;
		}
		if (existing) return;

		/*
		 * Resolved on every use rather than captured. Obsidian can rename the
		 * property on an existing row, changing `data-property-key` in place; a
		 * target captured at decoration time would then quietly act on the
		 * previous property, and because the button already exists it would never
		 * be rebuilt to notice.
		 */
		const target = (): ButtonTarget | null => {
			const current = propertyKeyOf(row);
			if (!current || current !== this.plugin.settings.propertyNames.container) return null;
			return { notePath, propertyKey: current };
		};

		const host = row.querySelector(VALUE_CELL) ?? row;
		host.appendChild(createMoveButton(this.plugin, target));
	}

	/**
	 * If Obsidian renames these classes, a missing button is the only symptom
	 * the user would otherwise get. Say it once, in the console.
	 */
	private warnOnceIfStructureMissing(): void {
		if (this.warned) return;
		const hasContainer = activeDocument.querySelector(METADATA_CONTAINER) !== null;
		const hasRows = activeDocument.querySelector(PROPERTY_ROW) !== null;
		if (hasContainer && !hasRows) {
			this.warned = true;
			console.warn(
				'[inventory-organizer] properties container found but no .metadata-property rows; ' +
					'the inline button is unavailable. Use the "Move item to container" command instead.',
			);
		}
	}
}

/**
 * Whether a batch of mutations could plausibly have changed a property row.
 *
 * Errs towards true on purpose: a false positive costs one wasted sweep, a
 * false negative costs a missing button until the next workspace event.
 */
function touchesProperties(records: MutationRecord[]): boolean {
	for (const record of records) {
		const target = record.target;
		if (target.instanceOf(Element) && target.closest(METADATA_CONTAINER)) return true;
		if (containsProperties(record.addedNodes) || containsProperties(record.removedNodes)) return true;
	}
	return false;
}

function containsProperties(nodes: NodeList): boolean {
	for (const node of Array.from(nodes)) {
		if (!node.instanceOf(Element)) continue;
		if (node.matches(METADATA_CONTAINER) || node.matches(PROPERTY_ROW)) return true;
		if (node.querySelector(`${METADATA_CONTAINER}, ${PROPERTY_ROW}`)) return true;
	}
	return false;
}
