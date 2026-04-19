import { randomBytes } from 'node:crypto';
import { sha256Hex } from './crypto.js';

/**
 * API tokens used by third-party systems to call a specific assistant's /v1 API.
 *
 * Format: `pta_live_<24 url-safe chars>`
 *
 * Stored only as SHA-256 hash in `apiTokens/{hash}`. Plaintext is shown to the
 * user once at creation time. The top-level collection lets the Cloud Functions
 * runtime look up `{ownerUid, assistantId}` by hash in O(1).
 */
const PREFIX = 'pta_live_';
const BODY_LEN = 24;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function generateApiToken(): { plaintext: string; tokenHash: string; lastFour: string } {
	const bytes = randomBytes(BODY_LEN);
	let body = '';
	for (let i = 0; i < BODY_LEN; i++) {
		body += ALPHABET[bytes[i] % ALPHABET.length];
	}
	const plaintext = `${PREFIX}${body}`;
	return {
		plaintext,
		tokenHash: sha256Hex(plaintext),
		lastFour: plaintext.slice(-4)
	};
}

export function hashApiToken(plaintext: string): string {
	return sha256Hex(plaintext.trim());
}

export function isApiTokenFormat(value: string): boolean {
	return /^pta_live_[A-Za-z0-9]{24}$/.test(value.trim());
}
