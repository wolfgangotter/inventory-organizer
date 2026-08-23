import { Modal, Setting, type App } from 'obsidian';

/**
 * A yes/no gate for the moves that are legal but unusual.
 *
 * Used sparingly and on purpose: a prompt the user sees on every move is a
 * prompt they stop reading, which would make the cross-inventory warning
 * worthless exactly when it matters.
 */
export class ConfirmModal extends Modal {
	private confirmed = false;

	constructor(
		app: App,
		private readonly options: {
			title: string;
			body: string[];
			confirmText: string;
			onConfirm: () => void;
		},
	) {
		super(app);
	}

	override onOpen(): void {
		this.setTitle(this.options.title);
		for (const line of this.options.body) {
			this.contentEl.createEl('p', { text: line });
		}

		new Setting(this.contentEl)
			.addButton((button) =>
				button.setButtonText('Cancel').onClick(() => {
					this.close();
				}),
			)
			.addButton((button) =>
				button
					.setButtonText(this.options.confirmText)
					.setCta()
					.onClick(() => {
						this.confirmed = true;
						this.close();
					}),
			);
	}

	override onClose(): void {
		this.contentEl.empty();
		// Fires after close so the callback never races the modal teardown.
		if (this.confirmed) this.options.onConfirm();
	}
}
