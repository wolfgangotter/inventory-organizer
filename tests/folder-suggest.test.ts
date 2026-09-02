/**
 * @vitest-environment jsdom
 *
 * What happens when a folder is picked from the dropdown.
 *
 * The order of the four steps is the entire fix for a dropdown that used to
 * reopen on top of itself, so it is asserted directly rather than inferred from
 * the result.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FolderSuggest } from '../src/ui/folder-suggest';
import { createMockApp } from './stubs/obsidian';
import { installObsidianDom } from './stubs/dom';

const VAULT = ['Films', 'Films/Genres', 'Films/Genres/Individual Movies', 'Archive'];

/** A suggester on a contenteditable, with the calls it made recorded in order. */
function makeSuggest(onPick: (folder: string) => void = () => {}, home: string | null = 'Films') {
	const element = document.createElement('div');
	element.setAttribute('contenteditable', 'true');
	document.body.appendChild(element);

	const suggest = new FolderSuggest(
		createMockApp() as never,
		element,
		() => VAULT,
		() => home,
		onPick,
	);
	// The stub records these; the real base class does not expose them.
	const log = suggest as unknown as { calls: string[]; value: string };
	return { suggest, element, log };
}

beforeEach(() => {
	installObsidianDom();
	document.body.replaceChildren();
});

describe('picking a folder', () => {
	it('fills the field, closes, drops focus, and only then writes', () => {
		/*
		 * The bug this pins: the first version closed and wrote, leaving the
		 * field holding the half-typed query and still focused. Writing the note
		 * re-renders the property row under that focus, and the dropdown opened
		 * again querying the value just written - so it listed only that folder
		 * and its descendants, every pick took two goes, and nothing outside the
		 * inventory's own folder could be reached at all.
		 *
		 * Every step is asserted in sequence because any reordering brings some
		 * part of that back.
		 */
		const { suggest, element, log } = makeSuggest((folder) => log.calls.push(`write:${folder}`));
		vi.spyOn(element, 'blur').mockImplementation(() => log.calls.push('blur'));

		suggest.selectSuggestion('Films/Genres');

		expect(log.calls).toEqual(['setValue', 'close', 'blur', 'write:Films/Genres']);
	});

	it('leaves the chosen folder in the field, not the query', () => {
		const { suggest, log } = makeSuggest();
		suggest.selectSuggestion('Archive');
		expect(log.value).toBe('Archive');
	});
});

describe('suggestions offered', () => {
	/** `getSuggestions` is protected; the popover calls it, so the test does too. */
	const ask = (suggest: FolderSuggest, query: string): string[] =>
		(suggest as unknown as { getSuggestions: (q: string) => string[] }).getSuggestions(query);

	it('offers the inventory’s own folder first', () => {
		const { suggest } = makeSuggest();
		expect(ask(suggest, '')).toEqual([
			'Films',
			'Films/Genres',
			'Films/Genres/Individual Movies',
			'Archive',
		]);
	});

	it('narrows as the path is typed', () => {
		const { suggest } = makeSuggest();
		expect(ask(suggest, 'Films/Gen')).toEqual(['Films/Genres', 'Films/Genres/Individual Movies']);
	});

	it('keeps every folder reachable once the field holds a complete path', () => {
		// Re-opening the dropdown on a field already set must not narrow to the
		// value being changed away from.
		const { suggest } = makeSuggest();
		expect(ask(suggest, 'Archive')).toEqual(ask(suggest, ''));
	});
});
