import { describe, expect, it } from 'vitest';
import { isUuid, newId } from '../src/core/ids';

describe('newId', () => {
	it('produces a v4 uuid', () => {
		expect(isUuid(newId())).toBe(true);
	});

	it('does not repeat', () => {
		const seen = new Set(Array.from({ length: 500 }, () => newId()));
		expect(seen.size).toBe(500);
	});
});

describe('isUuid', () => {
	it('accepts the ids already in the vault', () => {
		expect(isUuid('770fa218-07a3-4f0d-bdcc-d3dda432d1bb')).toBe(true);
		expect(isUuid('f37c87b8-b073-47af-9877-ba35790aa9e8')).toBe(true);
	});

	it('rejects anything else', () => {
		expect(isUuid('not-a-uuid')).toBe(false);
		expect(isUuid('')).toBe(false);
		expect(isUuid(undefined)).toBe(false);
		expect(isUuid(123)).toBe(false);
	});
});
