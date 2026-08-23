import { normalizePath, TFile, type App } from 'obsidian';
import { InventoryError } from '../core/errors';
import type { NewNoteSpec } from '../core/create';
import { uniquePath } from '../core/naming';
import type { FrontmatterWriter } from './frontmatter-port';

/**
 * Creates a note from a spec and opens it.
 *
 * The body is written first and the frontmatter applied second, through
 * `processFrontMatter`, so Obsidian serialises the YAML. Nothing in this plugin
 * ever assembles a frontmatter block by hand - links in particular need exact
 * quoting, and getting it subtly wrong produces a note that looks fine and
 * silently fails to link.
 */
export class NoteFactory {
	constructor(
		private readonly app: App,
		private readonly frontmatter: FrontmatterWriter,
	) {}

	/** Ensures a folder exists, creating intermediate levels as needed. */
	private async ensureFolder(folder: string | null): Promise<void> {
		if (!folder) return;
		const path = normalizePath(folder);
		if (this.app.vault.getFolderByPath(path)) return;
		try {
			await this.app.vault.createFolder(path);
		} catch (err) {
			// Two commands racing, or the folder appearing between the check and
			// the call. Only a real failure matters, and `create` will surface it.
			console.error('[inventory-organizer] could not create folder', err);
		}
	}

	/**
	 * @param build  receives the final path, because a link's text depends on
	 *               where it is being written from - and the path is only known
	 *               once uniqueness has been resolved.
	 */
	async create(
		folder: string | null,
		fileName: string,
		build: (path: string) => NewNoteSpec,
	): Promise<TFile> {
		await this.ensureFolder(folder);

		const path = uniquePath(
			folder,
			fileName,
			(candidate) => this.app.vault.getAbstractFileByPath(candidate) !== null,
		);
		const spec = build(path);

		let file: TFile;
		try {
			file = await this.app.vault.create(path, spec.body ? `${spec.body}\n` : '');
		} catch (err) {
			throw new InventoryError('create-failed', `could not create ${path}`, { cause: err });
		}

		// A note that exists but never got its properties is worse than no note:
		// it is invisible to every Bases view and looks like nothing happened.
		try {
			await this.frontmatter.apply(file, { set: spec.frontmatter });
		} catch (err) {
			await this.app.fileManager.trashFile(file);
			throw err;
		}

		return file;
	}

	async open(file: TFile): Promise<void> {
		await this.app.workspace.getLeaf(false).openFile(file);
	}
}
