import { FuzzySuggestModal, type App, type FuzzyMatch } from 'obsidian';
import type { InventoryNote } from '../core/schema';

/**
 * Pick a container.
 *
 * The reason this exists rather than leaning on Obsidian's own link
 * autocomplete: the native field offers every note in the vault, so choosing
 * the right box means recognising it among thousands of unrelated notes. This
 * offers the containers of one inventory and nothing else.
 */
export class ContainerSuggestModal extends FuzzySuggestModal<InventoryNote> {
	constructor(
		app: App,
		private readonly containers: InventoryNote[],
		private readonly onChoose: (container: InventoryNote) => void,
		placeholder: string,
	) {
		super(app);
		this.setPlaceholder(placeholder);
		this.setInstructions([
			{ command: '↑↓', purpose: 'to navigate' },
			{ command: '↵', purpose: 'to move' },
			{ command: 'esc', purpose: 'to cancel' },
		]);
	}

	getItems(): InventoryNote[] {
		return this.containers;
	}

	getItemText(container: InventoryNote): string {
		// The folder is searchable too, which is what disambiguates two
		// containers that share a name.
		return `${container.ref.basename} ${container.ref.path}`;
	}

	renderSuggestion(match: FuzzyMatch<InventoryNote>, el: HTMLElement): void {
		const container = match.item;
		el.createDiv({ text: container.ref.basename, cls: 'io-suggest-title' });
		const folder = container.ref.path.split('/').slice(0, -1).join('/');
		if (folder) el.createDiv({ text: folder, cls: 'io-suggest-path' });
	}

	onChooseItem(container: InventoryNote): void {
		this.onChoose(container);
	}
}
