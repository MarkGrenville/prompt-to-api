import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/admin';
import { error, json } from '@sveltejs/kit';
import type { ApiTokenDoc } from '@prompt-to-api/shared';

export const PATCH: RequestHandler = async ({ request, locals, params }) => {
	if (!locals.uid) throw error(401, 'unauthenticated');
	const body = (await request.json()) as Record<string, unknown>;
	const allowed = ['name', 'systemPrompt', 'model', 'temperature', 'maxTokens', 'publicSpec'];
	const update: Record<string, unknown> = { updatedAt: Date.now() };
	for (const key of allowed) {
		if (key in body) update[key] = body[key];
	}
	await adminDb
		.collection('users')
		.doc(locals.uid)
		.collection('assistants')
		.doc(params.id)
		.update(update);
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.uid) throw error(401, 'unauthenticated');

	const assistantRef = adminDb
		.collection('users')
		.doc(locals.uid)
		.collection('assistants')
		.doc(params.id);

	// Revoke and delete tokens (both nested + top-level).
	const tokens = await assistantRef.collection('tokens').get();
	const batch = adminDb.batch();
	tokens.forEach((doc) => {
		const t = doc.data() as ApiTokenDoc;
		batch.delete(doc.ref);
		batch.delete(adminDb.collection('apiTokens').doc(t.tokenHash));
	});

	// Delete conversations + their messages
	const conversations = await assistantRef.collection('conversations').get();
	for (const conv of conversations.docs) {
		const msgs = await conv.ref.collection('messages').get();
		msgs.forEach((m) => batch.delete(m.ref));
		batch.delete(conv.ref);
	}

	batch.delete(assistantRef);
	await batch.commit();

	console.log('[api/assistants] deleted', { uid: locals.uid, assistantId: params.id });
	return json({ ok: true });
};
