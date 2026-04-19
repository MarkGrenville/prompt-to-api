import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { createConversation, listConversations } from '$lib/server/conversations';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.uid) throw error(401, 'unauthenticated');
	const items = await listConversations(locals.uid, params.id);
	return json({ conversations: items });
};

export const POST: RequestHandler = async ({ request, locals, params }) => {
	if (!locals.uid) throw error(401, 'unauthenticated');
	const body = (await request.json().catch(() => ({}))) as { title?: string };
	const conversation = await createConversation({
		ownerUid: locals.uid,
		assistantId: params.id,
		title: body.title,
		source: 'dashboard'
	});
	return json(conversation, { status: 201 });
};
