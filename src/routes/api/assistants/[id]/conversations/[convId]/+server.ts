import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { deleteConversation, getConversation } from '$lib/server/conversations';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.uid) throw error(401, 'unauthenticated');
	const conv = await getConversation(locals.uid, params.id, params.convId);
	if (!conv) return json({ error: 'conversation_not_found' }, { status: 404 });
	return json(conv);
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.uid) throw error(401, 'unauthenticated');
	const ok = await deleteConversation(locals.uid, params.id, params.convId);
	if (!ok) return json({ error: 'conversation_not_found' }, { status: 404 });
	return new Response(null, { status: 204 });
};
