import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import type { EncryptedProviderKey, ProviderId } from './types.js';

/**
 * AES-256-GCM envelope encryption used for LLM provider keys at rest.
 *
 * The key comes from `KEY_ENCRYPTION_SECRET` — a 32-byte hex string (`openssl rand -hex 32`).
 * For the emulator dev flow we fall back to a well-known dev key so the app still
 * works without extra config; this is overridden in production.
 */
const DEV_FALLBACK_KEY = '0'.repeat(64); // 32 bytes of zeros (hex)

function getKey(): Buffer {
	const raw = process.env.KEY_ENCRYPTION_SECRET?.trim();
	if (!raw) {
		if (process.env.NODE_ENV === 'production') {
			throw new Error('KEY_ENCRYPTION_SECRET is required in production');
		}
		console.warn('[crypto] KEY_ENCRYPTION_SECRET missing — using dev fallback key.');
		return Buffer.from(DEV_FALLBACK_KEY, 'hex');
	}
	const buf = Buffer.from(raw, 'hex');
	if (buf.length !== 32) {
		throw new Error(`KEY_ENCRYPTION_SECRET must be 32 bytes hex-encoded (got ${buf.length} bytes)`);
	}
	return buf;
}

export function encryptProviderKey(provider: ProviderId, plaintext: string): EncryptedProviderKey {
	const key = getKey();
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', key, iv);
	const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const authTag = cipher.getAuthTag();
	return {
		provider,
		ciphertext: ciphertext.toString('base64'),
		iv: iv.toString('base64'),
		authTag: authTag.toString('base64'),
		updatedAt: Date.now()
	};
}

export function decryptProviderKey(doc: EncryptedProviderKey): string {
	const key = getKey();
	const iv = Buffer.from(doc.iv, 'base64');
	const authTag = Buffer.from(doc.authTag, 'base64');
	const ciphertext = Buffer.from(doc.ciphertext, 'base64');
	const decipher = createDecipheriv('aes-256-gcm', key, iv);
	decipher.setAuthTag(authTag);
	const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
	return plaintext.toString('utf8');
}

export function sha256Hex(input: string): string {
	return createHash('sha256').update(input, 'utf8').digest('hex');
}
