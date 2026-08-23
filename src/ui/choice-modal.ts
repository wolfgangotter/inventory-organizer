import { FuzzySuggestModal, type App, type FuzzyMatch } from 'obsidian';

/**
 * One fuzzy picker for every "which note?" question in the plugin.
 *
 * Generic because the alternative was three near-identical modals; the only
 * thing that varies between picking a container, an inventory, or "none" is
 * what the rows say and what the choice produces.
 */
export interface Choice<T> {
	label: string;
	/** Muted second line - a folder path, usually. */
	description?: string;
	/** Extra text matched by the fuzzy search but never displayed. */
	searchText?: string;
	value: T;
}

export class ChoiceModal<T> extends FuzzySuggestModal<Choice<T>> {
	constructor(
		app: App,
		private readonly choices: Choice<T>[],
		private readonly onChoose: (value: T) => void,
		placeholder: string,
	) {
		super(app);
		this.setPlaceholder(placeholder);
	}

	getItems(): Choice<T>[] {
		return this.choices;
	}

	getItemText(choice: Choice<T>): string {
		return `${choice.label} ${choice.searchText ?? ''}`.trim();
	}

	renderSuggestion(match: FuzzyMatch<Choice<T>>, el: HTMLElement): void {
		el.createDiv({ text: match.item.label, cls: 'io-suggest-title' });
		if (match.item.description) {
			el.createDiv({ text: match.item.description, cls: 'io-suggest-path' });
		}
	}

	onChooseItem(choice: Choice<T>): void {
		this.onChoose(choice.value);
	}
}

/** The rows for a list of notes, with the folder as the muted second line. */
export function noteChoices<T extends { ref: { path: string; basename: string } }>(
	notes: readonly T[],
): Choice<T>[] {
	return notes.map((note) => ({
		label: note.ref.basename,
		// The folder is what disambiguates two containers sharing a name.
		description: note.ref.path.split('/').slice(0, -1).join('/') || undefined,
		searchText: note.ref.path,
		value: note,
	}));
}
