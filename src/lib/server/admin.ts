import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { env } from '$env/dynamic/private';

// Ensure emulator env vars are picked up BEFORE admin SDK is initialised. These
// hosts come from process.env (SvelteKit sets them via the PM2 env block) but
// also from `$env/dynamic/private` in case the dev user has them in .env.
if (env.FIRESTORE_EMULATOR_HOST && !process.env.FIRESTORE_EMULATOR_HOST) {
	process.env.FIRESTORE_EMULATOR_HOST = env.FIRESTORE_EMULATOR_HOST;
}
if (env.FIREBASE_AUTH_EMULATOR_HOST && !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
	process.env.FIREBASE_AUTH_EMULATOR_HOST = env.FIREBASE_AUTH_EMULATOR_HOST;
}

if (!getApps().length) {
	const projectId = env.ADMIN_PROJECT_ID || 'prompt-to-api';
	const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

	try {
		if (usingEmulator) {
			// Emulator just needs a project ID; no credentials required.
			initializeApp({ projectId });
			console.log('[admin] initialized against emulator', {
				projectId,
				firestore: process.env.FIRESTORE_EMULATOR_HOST,
				auth: process.env.FIREBASE_AUTH_EMULATOR_HOST
			});
		} else if (env.ADMIN_PRIVATE_KEY && env.ADMIN_CLIENT_EMAIL) {
			initializeApp({
				credential: cert({
					projectId,
					clientEmail: env.ADMIN_CLIENT_EMAIL,
					privateKey: env.ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
				})
			});
			console.log('[admin] initialized with service-account credentials', { projectId });
		} else {
			initializeApp({ credential: applicationDefault(), projectId });
			console.log('[admin] initialized with application default credentials', { projectId });
		}
	} catch (err) {
		console.error('[admin] initialization failed', err);
		throw err;
	}
}

export const adminDb = getFirestore();
export const adminAuth = getAuth();
