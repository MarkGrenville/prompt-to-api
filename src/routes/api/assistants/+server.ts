import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { createAssistantWithToken } from '$lib/server/assistants';
import type { ProviderId } from '@prompt-to-api/shared';

const PROVIDERS: ProviderId[] = ['anthropic', 'openai', 'gemini'];

export const POST: RequestHandler = async ({ request, locals, cookies }) => {
	if (!locals.uid) throw error(401, 'unauthenticated');
	const body = (await request.json()) as {
		name?: string;
		systemPrompt?: string;
		provider?: ProviderId;
		model?: string;
		temperature?: number;
		maxTokens?: number;
	};
	if (!body.name?.trim()) return json({ error: 'name_required' }, { status: 400 });
	if (!body.systemPrompt?.trim()) return json({ error: 'system_prompt_required' }, { status: 400 });
	if (!body.provider || !PROVIDERS.includes(body.provider)) {
		return json({ error: 'invalid_provider' }, { status: 400 });
	}

	const { assistant, initialToken } = await createAssistantWithToken(locals.uid, {
		name: body.name,
		systemPrompt: body.systemPrompt,
		provider: body.provider,
		model: body.model,
		temperature: body.temperature,
		maxTokens: body.maxTokens
	});

	// Stash the plaintext token in a single-read cookie so the next page can
	// show it to the user once without putting it in the URL.
	cookies.set(`pta_token_once_${assistant.id}`, initialToken.plaintext, {
		path: `/app/assistants/${assistant.id}`,
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		maxAge: 60 // 1 minute
	});

	return json({ id: assistant.id, slug: assistant.slug });
};
