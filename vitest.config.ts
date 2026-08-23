import { defineConfig } from 'vitest/config';

/*
 * No `obsidian` alias yet: every module under test is pure and imports nothing.
 * When a plugin-load smoke test arrives it will need a stub aliased here, the
 * way cover-image-picker does it - but pointing the alias at a file that does
 * not exist would be worse than not having one.
 */
export default defineConfig({
	test: {
		environment: 'node',
		include: ['tests/**/*.test.ts'],
		restoreMocks: true,
		clearMocks: true,
	},
});
