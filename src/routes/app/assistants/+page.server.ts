import type { PageServerLoad } from './$types';
import { adminDb } from '$lib/server/admin';
import type { AssistantDoc } from '@prompt-to-api/shared';

export const load: PageServerLoad = async ({ locals }) => {
	const uid = locals.uid!;
	const snap = await adminDb
		.collection('users')
		.doc(uid)
		.collection('assistants')
		.orderBy('createdAt', 'desc')
		.get();
	const assistants: AssistantDoc[] = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AssistantDoc);

	// Provider key presence (so we can show a warning).
	const keysSnap = await adminDb.collection('users').doc(uid).collection('providerKeys').get();
	const configuredProviders = keysSnap.docs.map((d) => d.id);

	return { assistants, configuredProviders };
};
