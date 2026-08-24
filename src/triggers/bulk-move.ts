import { Notice, TFile, TFolder, Vault, type TAbstractFile } from 'obsidian';
import { commonInventory, describeBulkPlan, planBulkMove, plural } from '../core/bulk';
import { clearContainerPatch, movePatch } from '../core/move';
import { orderByRecent } from '../core/recent';
import type { InventoryNote } from '../core/schema';
import { ChoiceModal, noteChoices } from '../ui/choice-modal';
import { ConfirmModal } from '../ui/confirm-modal';
import type InventoryOrganizerPlugin from '../main';

/** Where an item sat before the last bulk move, so it can be put back. */
export interface UndoEntry {
	itemPath: string;
	/** Resolved path of the previous container, or null if it was unplaced. */
	previousContainerPath: string | null;
}

export interface BulkUndo {
	targetName: string;
	entries: UndoEntry[];
}

/** Every markdown file in a selection, with folders expanded. */
export function expandSelection(files: readonly TAbstractFile[]): TFile[] {
	const seen = new Map<string, TFile>();
	for (const entry of files) {
		if (entry instanceof TFile) {
			if (entry.extension === 'md') seen.set(entry.path, entry);
		} else if (entry instanceof TFolder) {
			Vault.recurseChildren(entry, (child) => {
				if (child instanceof TFile && child.extension === 'md') seen.set(child.path, child);
			});
		}
	}
	return [...seen.values()];
}

/** The items among a selection, resolved. */
export function itemsIn(plugin: InventoryOrganizerPlugin, files: readonly TAbstractFile[]): InventoryNote[] {
	return expandSelection(files)
		.map((file) => plugin.index.noteFor(file))
		.filter((note) => note.kind === 'item');
}

export function startBulkMove(plugin: InventoryOrganizerPlugin, selection: readonly TAbstractFile[]): void {
	const items = itemsIn(plugin, selection);
	if (items.length === 0) {
		new Notice('No inventory items in the selection.');
		return;
	}

	// A selection that disagrees about its inventory widens the picker rather
	// than silently preferring one of them.
	const scope = commonInventory(items);
	const containers = orderByRecent(plugin.index.containers(scope), plugin.settings.recentContainers);
	if (containers.length === 0) {
		new Notice('No containers found. Create one first.');
		return;
	}

	new ChoiceModal(
		plugin.app,
		noteChoices(containers),
		(target) => {
			confirmAndRun(plugin, items, target);
		},
		`Move ${plural(items.length, 'item')} to…`,
	).open();
}

function confirmAndRun(
	plugin: InventoryOrganizerPlugin,
	items: InventoryNote[],
	target: InventoryNote,
): void {
	const plan = planBulkMove(items, target);

	if (plan.movable.length === 0) {
		new Notice(
			plan.skipped.length > 0 ? 'Everything selected is already in that container.' : 'Nothing to move.',
		);
		return;
	}

	/*
	 * Always confirmed, not only when something is unusual.
	 *
	 * Obsidian's undo is per-editor, so a bulk write across dozens of notes
	 * cannot be taken back by hand. The in-session undo below covers the
	 * mistake, but this dialog is the cheaper place to catch it - and it is the
	 * only point where a wrong selection is still free to fix.
	 */
	new ConfirmModal(plugin.app, {
		title: 'Move items?',
		body: describeBulkPlan(plan, target.ref.basename),
		confirmText: 'Move',
		onConfirm: () => void run(plugin, plan.movable, target),
	}).open();
}

async function run(
	plugin: InventoryOrganizerPlugin,
	items: InventoryNote[],
	target: InventoryNote,
): Promise<void> {
	const targetFile = plugin.index.fileFor(target);
	if (!targetFile) {
		new Notice('That container no longer exists.');
		return;
	}

	const entries: UndoEntry[] = [];
	let failed = 0;

	/*
	 * Sequential on purpose. Each write is a read-modify-write that also flushes
	 * the note's open editor; running them concurrently interleaves those steps
	 * across files. A partial failure is reported rather than rolled back -
	 * there is no transaction to roll back to, and claiming otherwise would be
	 * worse than saying what happened.
	 */
	for (const item of items) {
		const file = plugin.index.fileFor(item);
		if (!file) {
			failed++;
			continue;
		}
		try {
			const linktext = plugin.index.linktextFor(targetFile, file.path);
			await plugin.frontmatter.apply(file, movePatch(plugin.settings.propertyNames, linktext));
			entries.push({ itemPath: item.ref.path, previousContainerPath: item.containerPath });
		} catch (err) {
			console.error(`[inventory-organizer] could not move ${item.ref.path}`, err);
			failed++;
		}
	}

	if (entries.length > 0) {
		plugin.lastBulkMove = { targetName: target.ref.basename, entries };
		await plugin.rememberContainer(target.ref.path);
	}

	new Notice(
		failed === 0
			? `Moved ${plural(entries.length, 'item')} to ${target.ref.basename}.`
			: `Moved ${entries.length} of ${items.length}. ${plural(failed, 'note')} could not be written.`,
	);
}

/**
 * Puts the last bulk move back.
 *
 * Session-only and deliberately not persisted: an undo offered after a restart
 * would be acting on a vault it no longer has any reason to believe it knows.
 */
export async function undoLastBulkMove(plugin: InventoryOrganizerPlugin): Promise<void> {
	const undo = plugin.lastBulkMove;
	if (!undo) {
		new Notice('No bulk move to undo.');
		return;
	}
	// Consumed up front: a half-applied undo must not be repeatable.
	plugin.lastBulkMove = null;

	let restored = 0;
	let failed = 0;

	for (const entry of undo.entries) {
		const file = plugin.app.vault.getFileByPath(entry.itemPath);
		if (!(file instanceof TFile)) {
			failed++;
			continue;
		}

		try {
			const previous = entry.previousContainerPath
				? plugin.app.vault.getFileByPath(entry.previousContainerPath)
				: null;

			if (entry.previousContainerPath && !(previous instanceof TFile)) {
				// The container it came from is gone; unplacing is the honest
				// approximation, and validation will report it as unplaced.
				await plugin.frontmatter.apply(file, clearContainerPatch(plugin.settings.propertyNames));
			} else if (previous instanceof TFile) {
				const linktext = plugin.index.linktextFor(previous, file.path);
				await plugin.frontmatter.apply(file, movePatch(plugin.settings.propertyNames, linktext));
			} else {
				await plugin.frontmatter.apply(file, clearContainerPatch(plugin.settings.propertyNames));
			}
			restored++;
		} catch (err) {
			console.error(`[inventory-organizer] could not restore ${entry.itemPath}`, err);
			failed++;
		}
	}

	new Notice(
		failed === 0
			? `Put ${plural(restored, 'item')} back.`
			: `Restored ${restored} of ${undo.entries.length}. ${plural(failed, 'note')} could not be written.`,
	);
}
