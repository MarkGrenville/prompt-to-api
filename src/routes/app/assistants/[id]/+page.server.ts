import type { PageServerLoad } from './$types';
import { adminDb } from '$lib/server/admin';
import { error } from '@sveltejs/kit';
import type { AssistantDoc, ApiTokenDoc } from '@prompt-to-api/shared';
import { PUBLIC_APP_ENV } from '$env/static/public';
import { env } from '$env/dynamic/private';

export const load: PageServerLoad = async ({ locals, params, url, cookies }) => {
	const uid = locals.uid!;
	const { id } = params;

	const snap = await adminDb
		.collection('users')
		.doc(uid)
		.collection('assistants')
		.doc(id)
		.get();
	if (!snap.exists) throw error(404, 'assistant_not_found');
	const assistant = { id: snap.id, ...snap.data() } as AssistantDoc;

	const tokensSnap = await adminDb
		.collection('users')
		.doc(uid)
		.collection('assistants')
		.doc(id)
		.collection('tokens')
		.orderBy('createdAt', 'desc')
		.get();
	const tokens = tokensSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as ApiTokenDoc & { id: string });

	// Initial token, shown once after creation.
	const tokenOnce = cookies.get(`pta_token_once_${id}`) ?? null;
	if (tokenOnce) {
		cookies.delete(`pta_token_once_${id}`, { path: `/app/assistants/${id}` });
	}

	// Base URL for the public API (the one third-parties call).
	const publicApiBase = computePublicApiBase(url);

	return {
		assistant,
		tokens,
		tokenOnce,
		publicApiBase,
		showInitialToken: url.searchParams.has('showInitialToken')
	};
};

/**
 * Compute the base URL that third-parties should use to call this assistant.
 *
 * - Local dev: the Firebase Functions emulator at localhost:9232 with the
 *   standard /<project>/<region>/<function> prefix.
 * - Prod: the hosting domain with /v1/**.
 */
function computePublicApiBase(url: URL): string {
	const envName = PUBLIC_APP_ENV || 'development';
	if (envName !== 'production') {
		const projectId = env.ADMIN_PROJECT_ID || 'prompt-to-api';
		return `http://localhost:9232/${projectId}/us-central1/api/v1`;
	}
	return `${url.origin}/v1`;
}
