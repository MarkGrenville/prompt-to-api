import type { PageServerLoad } from './$types';
import { adminDb } from '$lib/server/admin';
import type { ProviderId } from '@prompt-to-api/shared';

const PROVIDERS: ProviderId[] = ['anthropic', 'openai', 'gemini'];

export const load: PageServerLoad = async ({ locals }) => {
	const uid = locals.uid!;
	const existing: Record<ProviderId, { updatedAt: number | null; hasKey: boolean }> = {
		anthropic: { updatedAt: null, hasKey: false },
		openai: { updatedAt: null, hasKey: false },
		gemini: { updatedAt: null, hasKey: false }
	};

	const snap = await adminDb.collection('users').doc(uid).collection('providerKeys').get();
	snap.forEach((doc) => {
		const id = doc.id as ProviderId;
		if (PROVIDERS.includes(id)) {
			const data = doc.data() as { updatedAt?: number };
			existing[id] = { updatedAt: data.updatedAt ?? null, hasKey: true };
		}
	});

	return { providerKeys: existing };
};
