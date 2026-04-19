import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { revokeToken } from '$lib/server/assistants';

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.uid) throw error(401, 'unauthenticated');
	await revokeToken(locals.uid, params.id, params.tokenId);
	return json({ ok: true });
};
