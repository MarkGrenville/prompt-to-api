import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals }) => {
	return json({
		ok: true,
		service: 'prompt-to-api (sveltekit)',
		authenticated: Boolean(locals.uid),
		ts: Date.now()
	});
};
