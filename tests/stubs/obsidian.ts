/**
 * Minimal stand-in for the `obsidian` module.
 *
 * Covers what the plugin touches while loading and what the file-explorer
 * adapters need, which is exactly what is otherwise untested: "failed to load
 * plugin" is the worst failure mode we can ship, and no test over `core/` can
 * see it.
 */

export interface EventRef {
	__eventRef?: true;
}

export class Events {
	on(): EventRef {
		return {};
	}
	off(): void {}
	offref(): void {}
	trigger(): void {}
}

export class Component {
	private children: Component[] = [];
	/**
	 * Detachers registered through register*(). Obsidian runs these on unload
	 * and so must this stub, or a test can assert "no stray buttons" while the
	 * listeners quietly survive.
	 */
	private cleanups: (() => void)[] = [];
	_loaded = false;

	load(): void {
		this._loaded = true;
		this.onload();
		for (const child of this.children) child.load();
	}
	onload(): void {}
	unload(): void {
		this._loaded = false;
		for (const child of this.children) child.unload();
		this.onunload();
		for (const cleanup of this.cleanups.splice(0)) cleanup();
	}
	onunload(): void {}
	addChild<T extends Component>(child: T): T {
		this.children.push(child);
		if (this._loaded) child.load();
		return child;
	}
	removeChild<T extends Component>(child: T): T {
		return child;
	}
	register(cleanup: () => void): void {
		this.cleanups.push(cleanup);
	}
	registerEvent(): void {}
	registerDomEvent(el: EventTarget, type: string, cb: EventListener): void {
		el.addEventListener(type, cb);
		this.cleanups.push(() => {
			el.removeEventListener(type, cb);
		});
	}
}

export class TAbstractFile {
	path = '';
	name = '';
}

export class TFile extends TAbstractFile {
	basename = '';
	extension = 'md';
	stat = { ctime: 0, mtime: 0, size: 0 };
}

export class TFolder extends TAbstractFile {
	children: TAbstractFile[] = [];
	isRoot(): boolean {
		return this.path === '';
	}
}

export class Vault extends Events {
	/** Depth-first walk, including the root itself - as Obsidian's does. */
	static recurseChildren(root: TFolder, cb: (file: TAbstractFile) => unknown): void {
		cb(root);
		for (const child of root.children) {
			if (child instanceof TFolder) Vault.recurseChildren(child, cb);
			else cb(child);
		}
	}
}

export class Notice {
	static last: string | DocumentFragment | null = null;
	constructor(public message: string | DocumentFragment) {
		Notice.last = message;
	}
	setMessage(): this {
		return this;
	}
	hide(): void {}
}

export class Modal {
	contentEl = document.createElement('div');
	titleEl = document.createElement('div');
	constructor(public app: unknown) {}
	open(): void {
		this.onOpen();
	}
	close(): void {
		this.onClose();
	}
	onOpen(): void {}
	onClose(): void {}
	setTitle(text: string): this {
		this.titleEl.textContent = text;
		return this;
	}
}

export abstract class SuggestModal<T> extends Modal {
	inputEl = document.createElement('input');
	setPlaceholder(): void {}
	setInstructions(): void {}
	abstract getSuggestions(query: string): T[] | Promise<T[]>;
	abstract renderSuggestion(value: T, el: HTMLElement): void;
	abstract onChooseSuggestion(item: T, evt: MouseEvent | KeyboardEvent): void;
}

export interface FuzzyMatch<T> {
	item: T;
	match: { score: number; matches: number[][] };
}

export abstract class FuzzySuggestModal<T> extends Modal {
	inputEl = document.createElement('input');
	setPlaceholder(): void {}
	setInstructions(): void {}
	abstract getItems(): T[];
	abstract getItemText(item: T): string;
	abstract onChooseItem(item: T, evt?: MouseEvent | KeyboardEvent): void;
}

export class Menu {
	items: MenuItem[] = [];
	addItem(cb: (item: MenuItem) => unknown): this {
		const item = new MenuItem();
		cb(item);
		this.items.push(item);
		return this;
	}
	showAtMouseEvent(): this {
		return this;
	}
	showAtPosition(): this {
		return this;
	}
}

export class MenuItem {
	title = '';
	icon = '';
	click: (() => void) | null = null;
	setTitle(title: string): this {
		this.title = title;
		return this;
	}
	setIcon(icon: string): this {
		this.icon = icon;
		return this;
	}
	onClick(cb: () => void): this {
		this.click = cb;
		return this;
	}
}

export class Setting {
	constructor(public containerEl: HTMLElement) {}
	setName(): this {
		return this;
	}
	setDesc(): this {
		return this;
	}
	setHeading(): this {
		return this;
	}
	addText(cb: (text: TextComponent) => unknown): this {
		cb(new TextComponent());
		return this;
	}
	addToggle(cb: (toggle: ToggleComponent) => unknown): this {
		cb(new ToggleComponent());
		return this;
	}
	addButton(cb: (button: ButtonComponent) => unknown): this {
		cb(new ButtonComponent());
		return this;
	}
}

export class TextComponent {
	inputEl = document.createElement('input');
	setPlaceholder(): this {
		return this;
	}
	setValue(): this {
		return this;
	}
	onChange(): this {
		return this;
	}
}

export class ToggleComponent {
	setValue(): this {
		return this;
	}
	onChange(): this {
		return this;
	}
}

export class ButtonComponent {
	setButtonText(): this {
		return this;
	}
	setCta(): this {
		return this;
	}
	onClick(): this {
		return this;
	}
}

export class SettingTab {
	containerEl = document.createElement('div');
	constructor(
		public app: unknown,
		public plugin: unknown,
	) {}
	display(): void {}
	hide(): void {}
	update(): void {}
	getSettingDefinitions(): unknown[] {
		return [];
	}
	getControlValue(_key: string): unknown {
		return undefined;
	}
	setControlValue(_key: string, _value: unknown): void | Promise<void> {}
}

export class PluginSettingTab extends SettingTab {}

/**
 * Enough of `AbstractInputSuggest` for the plugin to construct one.
 *
 * The real class binds listeners to the element and renders a popover; none of
 * that is what these tests are about, and the ranking it would display is
 * covered directly in `folders.test.ts`. Recording the element is what lets a
 * test see that a suggester was attached to the right row.
 */
export abstract class AbstractInputSuggest<T> {
	limit = 100;
	closed = false;
	value = '';
	/**
	 * What was called on this suggester, in order.
	 *
	 * The order is the whole point of the selection path: filling the field and
	 * dropping focus have to happen before anything writes the note, or the
	 * re-render reopens the dropdown under the user.
	 */
	calls: string[] = [];

	constructor(
		public app: unknown,
		public textInputEl: HTMLElement,
	) {}

	protected abstract getSuggestions(query: string): T[] | Promise<T[]>;
	abstract renderSuggestion(value: T, el: HTMLElement): void;
	selectSuggestion(_value: T, _evt?: unknown): void {}
	open(): void {
		this.closed = false;
		this.calls.push('open');
	}
	close(): void {
		this.closed = true;
		this.calls.push('close');
	}
	setValue(value: string): void {
		this.value = value;
		this.calls.push('setValue');
	}
	getValue(): string {
		return this.value;
	}
	onSelect(_cb: (value: T, evt: unknown) => unknown): this {
		return this;
	}
}

export class Plugin extends Component {
	commands: { id: string; name: string }[] = [];
	settingTabs: unknown[] = [];
	/** Set by a test to make loadData() throw, as an unreadable data.json does. */
	failLoad = false;
	private stored: unknown = undefined;

	constructor(
		public app: MockApp,
		public manifest: unknown,
	) {
		super();
	}
	addCommand<T extends { id: string; name: string }>(command: T): T {
		this.commands.push(command);
		return command;
	}
	addSettingTab(tab: unknown): void {
		this.settingTabs.push(tab);
	}
	async loadData(): Promise<unknown> {
		if (this.failLoad) throw new SyntaxError('unexpected token');
		return this.stored;
	}
	async saveData(data: unknown): Promise<void> {
		this.stored = data;
	}
}

export class MarkdownView {
	file: TFile | null = null;
	contentEl = document.createElement('div');
}

export function normalizePath(path: string): string {
	return path
		.replace(/\\/g, '/')
		.replace(/\/{2,}/g, '/')
		.replace(/^\/|\/$/g, '');
}

export function setIcon(el: HTMLElement, icon: string): void {
	el.setAttribute('data-icon', icon);
}

export function setTooltip(el: HTMLElement, text: string): void {
	el.setAttribute('aria-label', text);
}

export function debounce<T extends unknown[]>(cb: (...args: T) => unknown): (...args: T) => void {
	return (...args: T) => cb(...args);
}

/* ------------------------------------------------------------------ app */

export interface MockApp {
	workspace: {
		containerEl: HTMLElement;
		on: () => EventRef;
		off: () => void;
		offref: () => void;
		onLayoutReady: (cb: () => void) => void;
		getActiveViewOfType: () => MarkdownView | null;
		getLeavesOfType: () => { view: unknown }[];
		getLeaf: () => { openFile: () => Promise<void> };
	};
	vault: {
		on: () => EventRef;
		getMarkdownFiles: () => TFile[];
		getFileByPath: (path: string) => TFile | null;
		getFolderByPath: () => TFolder | null;
		getAllFolders: (includeRoot?: boolean) => TFolder[];
		getAbstractFileByPath: () => TAbstractFile | null;
		create: () => Promise<TFile>;
		createFolder: () => Promise<TFolder>;
	};
	metadataCache: {
		on: () => EventRef;
		offref: () => void;
		getFileCache: () => null;
		fileToLinktext: (file: TFile) => string;
		getFirstLinkpathDest: () => TFile | null;
	};
	fileManager: {
		/** Runs `fn` against `frontmatter`, as Obsidian's read-modify-write does. */
		processFrontMatter: (file: TFile, fn: (frontmatter: Record<string, unknown>) => void) => Promise<void>;
		/** What the last processFrontMatter call left behind, for assertions. */
		frontmatter: Record<string, unknown>;
		trashFile: () => Promise<void>;
	};
}

export function createMockApp(): MockApp {
	const noopRef = (): EventRef => ({});
	return {
		workspace: {
			containerEl: document.createElement('div'),
			on: noopRef,
			off: () => {},
			offref: () => {},
			onLayoutReady: (cb) => cb(),
			getActiveViewOfType: () => null,
			getLeavesOfType: () => [],
			getLeaf: () => ({ openFile: async () => {} }),
		},
		vault: {
			on: noopRef,
			getMarkdownFiles: () => [],
			getFileByPath: () => null,
			getFolderByPath: () => null,
			getAllFolders: () => [],
			getAbstractFileByPath: () => null,
			create: async () => new TFile(),
			createFolder: async () => new TFolder(),
		},
		metadataCache: {
			on: noopRef,
			offref: () => {},
			getFileCache: () => null,
			fileToLinktext: (file) => file.path,
			getFirstLinkpathDest: () => null,
		},
		fileManager: {
			frontmatter: {},
			async processFrontMatter(_file, fn) {
				fn(this.frontmatter);
			},
			trashFile: async () => {},
		},
	};
}

/** A TFile shaped the way Obsidian's would be. */
export function makeFile(path: string): TFile {
	const file = new TFile();
	file.path = path;
	file.name = path.split('/').pop() ?? path;
	file.basename = file.name.replace(/\.md$/, '');
	file.extension = file.name.includes('.') ? (file.name.split('.').pop() ?? 'md') : 'md';
	return file;
}

/** A TFolder holding the given children. */
export function makeFolder(path: string, children: TAbstractFile[] = []): TFolder {
	const folder = new TFolder();
	folder.path = path;
	folder.name = path.split('/').pop() ?? path;
	folder.children = children;
	return folder;
}
