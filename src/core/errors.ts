/** Error codes surfaced to the user as a Notice. Never expose internals. */
export type InventoryErrorCode =
	| 'note-not-found'
	| 'not-an-item'
	| 'target-not-container'
	| 'frontmatter-failed'
	| 'create-failed'
	| 'invalid-name';

/**
 * The only error type this plugin throws across a boundary.
 *
 * `message` is for the console. What the user sees comes from the call site,
 * so a YAML parser's internals never reach a Notice.
 */
export class InventoryError extends Error {
	constructor(
		readonly code: InventoryErrorCode,
		message: string,
		options?: ErrorOptions,
	) {
		super(message, options);
		this.name = 'InventoryError';
	}
}
