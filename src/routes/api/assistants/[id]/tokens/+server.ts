import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { createAdditionalToken } from '$lib/server/assistants';

export const POST: RequestHandler = async ({ request, locals, params }) => {
	if (!locals.uid) throw error(401, 'unauthenticated');
	const body = (await request.json().catch(() => ({}))) as { label?: string };
	const res = await createAdditionalToken(locals.uid, params.id, body.label ?? 'Token');
	return json(res);
};
