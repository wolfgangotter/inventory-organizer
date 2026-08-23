import { describe, expect, it } from 'vitest';
import { orderByRecent, withRecent } from '../src/core/recent';
import { container } from './helpers';

describe('orderByRecent', () => {
	const boxes = [container('Inv/Zinc Box.md'), container('Inv/Alpha Box.md'), container('Inv/Mid Box.md')];

	it('sorts alphabetically when nothing is recent', () => {
		expect(orderByRecent(boxes, []).map((c) => c.ref.basename)).toEqual([
			'Alpha Box',
			'Mid Box',
			'Zinc Box',
		]);
	});

	it('puts recent containers first, in recency order', () => {
		const order = orderByRecent(boxes, ['Inv/Zinc Box.md', 'Inv/Mid Box.md']);
		expect(order.map((c) => c.ref.basename)).toEqual(['Zinc Box', 'Mid Box', 'Alpha Box']);
	});

	it('ignores recent paths that are not on offer', () => {
		const order = orderByRecent(boxes, ['Gone/Deleted Box.md', 'Inv/Mid Box.md']);
		expect(order[0]?.ref.basename).toBe('Mid Box');
	});

	it('does not mutate its input', () => {
		const original = [...boxes];
		orderByRecent(boxes, ['Inv/Zinc Box.md']);
		expect(boxes).toEqual(original);
	});
});

describe('withRecent', () => {
	it('adds to the front', () => {
		expect(withRecent(['b'], 'a', 8)).toEqual(['a', 'b']);
	});

	it('moves an existing entry to the front instead of duplicating it', () => {
		expect(withRecent(['a', 'b', 'c'], 'c', 8)).toEqual(['c', 'a', 'b']);
	});

	it('enforces the cap', () => {
		expect(withRecent(['a', 'b', 'c'], 'd', 2)).toEqual(['d', 'a']);
	});

	it('survives a zero or negative cap', () => {
		expect(withRecent(['a'], 'b', 0)).toEqual([]);
		expect(withRecent(['a'], 'b', -1)).toEqual([]);
	});
});
