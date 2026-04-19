import { initializeApp, applicationDefault, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
	try {
		if (process.env.ADMIN_PRIVATE_KEY && process.env.ADMIN_CLIENT_EMAIL) {
			initializeApp({
				credential: cert({
					projectId: process.env.ADMIN_PROJECT_ID ?? process.env.GCLOUD_PROJECT,
					clientEmail: process.env.ADMIN_CLIENT_EMAIL,
					privateKey: process.env.ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
				})
			});
		} else {
			initializeApp({ credential: applicationDefault() });
		}
		console.log('[admin] firebase-admin initialized', {
			emulator: Boolean(process.env.FIRESTORE_EMULATOR_HOST),
			projectId: process.env.GCLOUD_PROJECT ?? process.env.ADMIN_PROJECT_ID
		});
	} catch (err) {
		console.error('[admin] failed to initialize', err);
		throw err;
	}
}

export const db = getFirestore();
