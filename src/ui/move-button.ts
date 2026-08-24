import { Menu, Notice, setIcon, setTooltip, TFile } from 'obsidian';
import { clearContainerPatch } from '../core/move';
import { startMove } from '../triggers/move';
import type InventoryOrganizerPlugin from '../main';

export const BUTTON_CLASS = 'io-move-button';

/** Where the button sits: enough to find the note, resolved fresh on every use. */
export interface ButtonTarget {
	notePath: string;
	propertyKey: string;
}

/**
 * The button injected into an item's `container` property row.
 *
 * Needs no focus, which is the point: on mobile, focusing a property raises the
 * keyboard and shows no toolbar, so an affordance that works from a single tap
 * sidesteps the problem instead of fighting it.
 */
export function createMoveButton(
	plugin: InventoryOrganizerPlugin,
	getTarget: () => ButtonTarget | null,
): HTMLElement {
	const button = createDiv({ cls: BUTTON_CLASS });
	button.setAttribute('role', 'button');
	button.setAttribute('tabindex', '0');
	setIcon(button, 'package');
	setTooltip(button, 'Move to container');

	/*
	 * Suppress focus so tapping does not raise the keyboard, and stop the row
	 * underneath treating the tap as its own.
	 *
	 * `mousedown` only. Never preventDefault on `touchstart`: WebKit reads that
	 * as "gesture handled" and stops synthesising the click, leaving the button
	 * completely inert on iOS. Learned in cover-image-picker.
	 */
	button.addEventListener('mousedown', (evt) => {
		evt.preventDefault();
		evt.stopPropagation();
	});

	button.addEventListener('click', (evt) => {
		evt.preventDefault();
		evt.stopPropagation();
		act(plugin, getTarget(), evt, button);
	});

	button.addEventListener('keydown', (evt) => {
		if (evt.key !== 'Enter' && evt.key !== ' ') return;
		evt.preventDefault();
		act(plugin, getTarget(), null, button);
	});

	return button;
}

function act(
	plugin: InventoryOrganizerPlugin,
	target: ButtonTarget | null,
	evt: MouseEvent | null,
	button: HTMLElement,
): void {
	// A button that outlived its removal must be inert, not merely invisible.
	if (!plugin.settings.showPropertyButton || !target) return;

	const file = plugin.app.vault.getFileByPath(target.notePath);
	if (!(file instanceof TFile)) return;

	const note = plugin.index.noteFor(file);
	if (note.kind !== 'item') return;

	// Unplaced, or a link that no longer resolves: one tap, straight to the
	// picker, because there is nothing to offer a menu about.
	if (note.containerPath === null) {
		startMove(plugin, file);
		return;
	}

	const menu = new Menu();
	menu.addItem((entry) =>
		entry
			.setTitle('Move to another container')
			.setIcon('package')
			.onClick(() => {
				startMove(plugin, file);
			}),
	);

	const container = plugin.app.vault.getFileByPath(note.containerPath);
	if (container instanceof TFile) {
		menu.addItem((entry) =>
			entry
				.setTitle('Open container')
				.setIcon('external-link')
				.onClick(() => void plugin.app.workspace.getLeaf('tab').openFile(container)),
		);
	}

	menu.addItem((entry) =>
		entry
			.setTitle('Remove from container')
			.setIcon('x')
			.onClick(() => void clearContainer(plugin, file)),
	);

	if (evt) {
		menu.showAtMouseEvent(evt);
	} else {
		// Keyboard activation has no pointer to anchor to; the button's own
		// bottom-left edge keeps the menu next to what was activated rather
		// than in the corner of the screen.
		const rect = button.getBoundingClientRect();
		menu.showAtPosition({ x: rect.left, y: rect.bottom });
	}
}

async function clearContainer(plugin: InventoryOrganizerPlugin, file: TFile): Promise<void> {
	try {
		await plugin.frontmatter.apply(file, clearContainerPatch(plugin.settings.propertyNames));
		new Notice('Removed from its container.');
	} catch (err) {
		console.error('[inventory-organizer] could not clear the container', err);
		new Notice('The container could not be cleared.');
	}
}
