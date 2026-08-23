import { Modal, Setting, TFile, type App } from 'obsidian';
import type { Finding, Severity } from '../core/validate';

const SEVERITY_LABEL: Record<Severity, string> = {
	error: 'Errors',
	warning: 'Warnings',
	info: 'Notes',
};

const ORDER: Severity[] = ['error', 'warning', 'info'];

/**
 * The validation report.
 *
 * Every row opens the note it is about, because the point of the report is to
 * get the user to the problem - not to describe it. Nothing here offers to fix
 * anything: each finding has several plausible repairs, and picking one on the
 * user's behalf is how data gets quietly lost.
 */
export class ReportModal extends Modal {
	constructor(
		app: App,
		private readonly inventoryName: string,
		private readonly findings: Finding[],
	) {
		super(app);
	}

	override onOpen(): void {
		this.setTitle(`Inventory: ${this.inventoryName}`);

		if (this.findings.length === 0) {
			this.contentEl.createEl('p', { text: 'No problems found.' });
			return;
		}

		for (const severity of ORDER) {
			const group = this.findings.filter((finding) => finding.severity === severity);
			if (group.length === 0) continue;

			new Setting(this.contentEl).setName(`${SEVERITY_LABEL[severity]} (${group.length})`).setHeading();
			const list = this.contentEl.createDiv({ cls: 'io-report-group' });
			for (const finding of group) this.renderFinding(list, finding);
		}
	}

	private renderFinding(parent: HTMLElement, finding: Finding): void {
		const row = parent.createDiv({ cls: `io-report-row io-report-${finding.severity}` });
		row.setAttribute('role', 'button');
		row.setAttribute('tabindex', '0');

		const name = finding.path.split('/').pop()?.replace(/\.md$/, '') ?? finding.path;
		row.createDiv({ text: name, cls: 'io-report-note' });
		row.createDiv({ text: finding.message, cls: 'io-report-message' });

		const open = () => {
			const file = this.app.vault.getFileByPath(finding.path);
			// The vault can change while the report is open; a stale row must do
			// nothing rather than throw.
			if (!(file instanceof TFile)) return;
			this.close();
			void this.app.workspace.getLeaf('tab').openFile(file);
		};

		row.addEventListener('click', open);
		row.addEventListener('keydown', (evt) => {
			if (evt.key !== 'Enter' && evt.key !== ' ') return;
			evt.preventDefault();
			open();
		});
	}

	override onClose(): void {
		this.contentEl.empty();
	}
}
