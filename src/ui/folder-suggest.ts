import { AbstractInputSuggest, type App } from 'obsidian';
import { rankFolders } from '../core/folders';

/**
 * Folder autocomplete for the `item_folder` / `container_folder` property rows.
 *
 * `AbstractInputSuggest` is public API and documented to accept a
 * contenteditable div, which is what Obsidian renders a Text property as - but
 * *finding* that div is not public, so the attaching lives in
 * `obsidian/property-dom` with the rest of the internal-DOM code and fails soft.
 *
 * Picking a folder writes the frontmatter rather than the input element. The
 * property row is a contenteditable whose commit path is Obsidian's business;
 * writing the file and letting the row re-render from it is the one route that
 * cannot leave the note and the field disagreeing.
 */
export class FolderSuggest extends AbstractInputSuggest<string> {
	constructor(
		app: App,
		element: HTMLInputElement | HTMLDivElement,
		private readonly folders: () => string[],
		/** Folder of the inventory note, whose contents are offered first. */
		private readonly home: () => string | null,
		private readonly onPick: (folder: string) => void,
	) {
		super(app, element);
	}

	protected getSuggestions(query: string): string[] {
		return rankFolders(this.folders(), query, this.home());
	}

	renderSuggestion(folder: string, el: HTMLElement): void {
		el.setText(folder);
	}

	override selectSuggestion(folder: string): void {
		this.close();
		this.onPick(folder);
	}
}
