import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { adminDb } from '$lib/server/admin';
import { encryptProviderKey, type ProviderId } from '@prompt-to-api/shared';

const VALID: ProviderId[] = ['anthropic', 'openai', 'gemini'];

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.uid) throw error(401, 'unauthenticated');
	const body = (await request.json()) as { provider?: ProviderId; apiKey?: string };
	if (!body.provider || !VALID.includes(body.provider)) {
		return json({ error: 'invalid_provider' }, { status: 400 });
	}
	const apiKey = (body.apiKey ?? '').trim();
	if (apiKey.length < 10) {
		return json({ error: 'api_key_too_short' }, { status: 400 });
	}

	const enc = encryptProviderKey(body.provider, apiKey);
	await adminDb
		.collection('users')
		.doc(locals.uid)
		.collection('providerKeys')
		.doc(body.provider)
		.set(enc);

	console.log('[api/keys] saved', { uid: locals.uid, provider: body.provider });
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ url, locals }) => {
	if (!locals.uid) throw error(401, 'unauthenticated');
	const provider = url.searchParams.get('provider') as ProviderId | null;
	if (!provider || !VALID.includes(provider)) {
		return json({ error: 'invalid_provider' }, { status: 400 });
	}
	await adminDb.collection('users').doc(locals.uid).collection('providerKeys').doc(provider).delete();
	console.log('[api/keys] deleted', { uid: locals.uid, provider });
	return json({ ok: true });
};
