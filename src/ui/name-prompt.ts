import { Modal, Setting, type App } from 'obsidian';
import { sanitizeFileName } from '../core/naming';

/**
 * Asks for a note title and refuses to proceed with an unusable one.
 *
 * The rejection is deliberate rather than silently substituting a cleaned-up
 * name: the title becomes a file path, and quietly renaming what the user typed
 * is worse than telling them it will not work.
 */
export class NamePromptModal extends Modal {
	private value = '';
	private submitted = false;

	constructor(
		app: App,
		private readonly options: {
			title: string;
			placeholder: string;
			onSubmit: (name: string) => void;
		},
	) {
		super(app);
	}

	override onOpen(): void {
		this.setTitle(this.options.title);

		const error = this.contentEl.createDiv({ cls: 'io-prompt-error' });
		error.hide();

		const submit = () => {
			const name = sanitizeFileName(this.value);
			if (!name) {
				error.setText('That name cannot be used for a note.');
				error.show();
				return;
			}
			this.submitted = true;
			this.close();
			this.options.onSubmit(name);
		};

		new Setting(this.contentEl).setName('Name').addText((text) => {
			text.setPlaceholder(this.options.placeholder).onChange((value) => {
				this.value = value;
				error.hide();
			});
			text.inputEl.addEventListener('keydown', (evt) => {
				if (evt.key !== 'Enter') return;
				evt.preventDefault();
				submit();
			});
			// The prompt exists to be typed into; focusing anything else wastes a tab.
			window.setTimeout(() => {
				text.inputEl.focus();
			}, 0);
		});

		new Setting(this.contentEl).addButton((button) =>
			button.setButtonText('Create').setCta().onClick(submit),
		);
	}

	override onClose(): void {
		this.contentEl.empty();
		if (!this.submitted) this.value = '';
	}
}
