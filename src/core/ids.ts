/**
 * Durable external keys.
 *
 * These are written on creation and preserved by migration, but nothing in this
 * plugin - and nothing in the Bases templates - may read them. They exist so the
 * inventory can be exported to or reconciled with a system outside the vault.
 * The moment a filter depends on one, we are back to the opaque-uuid problem
 * this plugin was built to remove.
 */
export function newId(): string {
	// Available in Obsidian's Electron and in mobile WebView; both are secure
	// contexts. Referenced bare rather than via `globalThis` so this stays valid
	// in a popout window. The fallback exists only for odd runtimes.
	const c: Crypto | undefined = typeof crypto === 'undefined' ? undefined : crypto;
	if (c && typeof c.randomUUID === 'function') return c.randomUUID();

	const bytes = new Uint8Array(16);
	if (c && typeof c.getRandomValues === 'function') {
		c.getRandomValues(bytes);
	} else {
		for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
	}
	// RFC 4122 version 4, variant 1.
	bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
	bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
	return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join(
		'-',
	);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
	return typeof value === 'string' && UUID_RE.test(value);
}
