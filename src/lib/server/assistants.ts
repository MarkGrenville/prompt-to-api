import { adminDb } from './admin.js';
import {
	generateApiToken,
	DEFAULT_MODELS,
	type AssistantDoc,
	type ProviderId,
	type ApiTokenDoc
} from '@prompt-to-api/shared';

/** Slugify a name to a url-safe token + strip duplicates by appending a short id. */
export function slugify(name: string): string {
	return (
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 40) || 'assistant'
	);
}

function shortId(): string {
	return Math.random().toString(36).slice(2, 8);
}

export interface CreateAssistantInput {
	name: string;
	systemPrompt: string;
	provider: ProviderId;
	model?: string;
	temperature?: number;
	maxTokens?: number;
}

export interface CreatedAssistant {
	assistant: AssistantDoc;
	initialToken: { plaintext: string; tokenId: string };
}

/** Create an assistant and auto-create its first API token. */
export async function createAssistantWithToken(
	uid: string,
	input: CreateAssistantInput
): Promise<CreatedAssistant> {
	const assistantsRef = adminDb.collection('users').doc(uid).collection('assistants');
	const assistantRef = assistantsRef.doc();
	const now = Date.now();

	const assistant: AssistantDoc = {
		id: assistantRef.id,
		name: input.name.trim(),
		slug: `${slugify(input.name)}-${shortId()}`,
		systemPrompt: input.systemPrompt.trim(),
		provider: input.provider,
		model: (input.model?.trim() || DEFAULT_MODELS[input.provider]) as string,
		temperature: clamp(input.temperature ?? 0.7, 0, 2),
		maxTokens: clamp(input.maxTokens ?? 2048, 16, 32_000),
		publicSpec: false,
		createdAt: now,
		updatedAt: now
	};

	const { plaintext, tokenHash, lastFour } = generateApiToken();
	const tokenRef = assistantRef.collection('tokens').doc();
	const tokenDoc: ApiTokenDoc = {
		tokenHash,
		ownerUid: uid,
		assistantId: assistant.id,
		label: 'Initial token',
		lastFour,
		createdAt: now,
		lastUsedAt: null,
		revokedAt: null
	};

	const batch = adminDb.batch();
	batch.set(assistantRef, assistant);
	// Per-user token record (for easy listing in the UI).
	batch.set(tokenRef, { ...tokenDoc, id: tokenRef.id });
	// Top-level hash-keyed index used for O(1) lookup by the public API.
	batch.set(adminDb.collection('apiTokens').doc(tokenHash), tokenDoc);
	await batch.commit();

	console.log('[assistants] created', { uid, assistantId: assistant.id, tokenId: tokenRef.id });
	return {
		assistant,
		initialToken: { plaintext, tokenId: tokenRef.id }
	};
}

export async function createAdditionalToken(
	uid: string,
	assistantId: string,
	label: string
): Promise<{ plaintext: string; tokenId: string; lastFour: string }> {
	const assistantRef = adminDb
		.collection('users')
		.doc(uid)
		.collection('assistants')
		.doc(assistantId);
	const snap = await assistantRef.get();
	if (!snap.exists) throw new Error('assistant_not_found');

	const { plaintext, tokenHash, lastFour } = generateApiToken();
	const tokenRef = assistantRef.collection('tokens').doc();
	const now = Date.now();
	const tokenDoc: ApiTokenDoc = {
		tokenHash,
		ownerUid: uid,
		assistantId,
		label: label.trim() || 'Token',
		lastFour,
		createdAt: now,
		lastUsedAt: null,
		revokedAt: null
	};

	const batch = adminDb.batch();
	batch.set(tokenRef, { ...tokenDoc, id: tokenRef.id });
	batch.set(adminDb.collection('apiTokens').doc(tokenHash), tokenDoc);
	await batch.commit();

	return { plaintext, tokenId: tokenRef.id, lastFour };
}

export async function revokeToken(uid: string, assistantId: string, tokenId: string): Promise<void> {
	const tokenRef = adminDb
		.collection('users')
		.doc(uid)
		.collection('assistants')
		.doc(assistantId)
		.collection('tokens')
		.doc(tokenId);
	const snap = await tokenRef.get();
	if (!snap.exists) return;
	const { tokenHash } = snap.data() as ApiTokenDoc;
	const now = Date.now();
	const batch = adminDb.batch();
	batch.update(tokenRef, { revokedAt: now });
	batch.update(adminDb.collection('apiTokens').doc(tokenHash), { revokedAt: now });
	await batch.commit();
	console.log('[assistants] token revoked', { uid, assistantId, tokenId });
}

function clamp(n: number, min: number, max: number): number {
	if (Number.isNaN(n)) return min;
	return Math.max(min, Math.min(max, n));
}
