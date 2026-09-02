import { AbstractInputSuggest, type App } from 'obsidian';
import { rankFolders } from '../core/folders';

/**
 * Folder autocomplete for the `item_folder` / `container_folder` property rows.
 *
 * `AbstractInputSuggest` is public API and documented to accept a
 * contenteditable div, which is what Obsidian renders a Text property as - but
 * *finding* that div is not public, so the attaching lives in
 * `obsidian/property-dom` with the rest of the internal-DOM code and fails soft.
 */
export class FolderSuggest extends AbstractInputSuggest<string> {
	constructor(
		app: App,
		private readonly element: HTMLInputElement | HTMLDivElement,
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

	/**
	 * Takes the pick, in an order that matters.
	 *
	 * The first version closed the popover and wrote the frontmatter, leaving
	 * the field holding the half-typed query and still focused. Writing the note
	 * re-renders the property row underneath that focus, and the dropdown opened
	 * again on top of itself - now querying the value just written, so it listed
	 * only that folder and its descendants and nothing else could be reached.
	 * Picking anything took two goes, and picking anything outside took none.
	 *
	 * So: fill the field, close, and drop focus *before* anything touches the
	 * file. A row that re-renders unfocused has nothing to reopen.
	 */
	override selectSuggestion(folder: string): void {
		this.setValue(folder);
		this.close();
		this.element.blur();
		this.onPick(folder);
	}
}
