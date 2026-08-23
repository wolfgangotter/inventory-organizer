import { MarkdownView, TFile, type App } from 'obsidian';
import { InventoryError } from '../core/errors';
import type { FrontmatterPatch } from '../core/schema';

/**
 * The only sanctioned write path: `processFrontMatter` is an atomic
 * read-modify-write that leaves the rest of the note alone. YAML is never
 * assembled by hand anywhere in this plugin.
 */
export class FrontmatterWriter {
	constructor(private readonly app: App) {}

	/**
	 * Flush pending editor edits for this note before writing.
	 *
	 * `TextFileView.requestSave` is debounced by two seconds while
	 * `processFrontMatter` works on the file on disk. Without this, typing and
	 * then immediately moving an item is a race the user loses: our write lands
	 * first, then the editor saves its stale copy and the move silently
	 * disappears. Learned the hard way in cover-image-picker (F6a).
	 */
	private async flushOpenEditors(file: TFile): Promise<void> {
		for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
			const view = leaf.view;
			if (!(view instanceof MarkdownView) || view.file?.path !== file.path) continue;
			try {
				await view.save();
			} catch (err) {
				// Best effort: a failed flush is not a reason to abandon the write.
				console.error('[inventory-organizer] could not flush pending edits', err);
			}
		}
	}

	/** Applies a patch. A `null` value removes the property entirely. */
	async apply(file: TFile, patch: FrontmatterPatch): Promise<void> {
		await this.flushOpenEditors(file);
		try {
			await this.app.fileManager.processFrontMatter(
				file,
				(frontmatter: Record<string, unknown>) => {
					for (const [key, value] of Object.entries(patch.set)) {
						if (value === null) delete frontmatter[key];
						else frontmatter[key] = value;
					}
				},
			);
		} catch (err) {
			// Most likely a YAMLParseError from frontmatter broken by hand.
			// The cause stays in the console; the user gets a safe message.
			throw new InventoryError('frontmatter-failed', 'processFrontMatter failed', { cause: err });
		}
	}
}
