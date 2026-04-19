import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/admin';
import { appendAndGenerate } from '$lib/server/conversations';
import type { AssistantDoc, ChatMessage } from '@prompt-to-api/shared';

export const POST: RequestHandler = async ({ request, locals, params }) => {
	if (!locals.uid) throw error(401, 'unauthenticated');
	const body = (await request.json()) as { messages?: ChatMessage[] };
	const newMessages = (body.messages ?? []).filter((m) => m && typeof m.content === 'string');
	if (newMessages.length === 0) {
		return json({ error: 'messages_required' }, { status: 400 });
	}

	const snap = await adminDb
		.collection('users')
		.doc(locals.uid)
		.collection('assistants')
		.doc(params.id)
		.get();
	if (!snap.exists) return json({ error: 'assistant_not_found' }, { status: 404 });
	const assistant = { id: snap.id, ...snap.data() } as AssistantDoc;

	const result = await appendAndGenerate({
		ownerUid: locals.uid,
		assistant,
		conversationId: params.convId,
		newMessages,
		source: 'dashboard'
	});

	if ('error' in result) {
		const status = result.error === 'provider_key_not_configured' ? 412 : 404;
		return json({ error: result.error }, { status });
	}
	return json(result);
};
