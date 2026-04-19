import type { Handle } from '@sveltejs/kit';
import { adminAuth } from '$lib/server/admin';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.uid = null;
	event.locals.email = null;

	// Cookie name MUST be `__session` — Firebase Hosting strips every other
	// cookie at the CDN edge before forwarding to Cloud Functions / Cloud Run.
	// https://firebase.google.com/docs/hosting/manage-cache#using_cookies
	const session = event.cookies.get('__session');
	if (session) {
		try {
			const decoded = await adminAuth.verifySessionCookie(session, true).catch(async () => {
				// Emulator issues ID tokens that verifySessionCookie may reject —
				// fall back to verifying the token directly when necessary.
				return await adminAuth.verifyIdToken(session, true);
			});
			event.locals.uid = decoded.uid;
			event.locals.email = decoded.email ?? null;
		} catch (err) {
			console.warn('[hooks] invalid session cookie', err instanceof Error ? err.message : err);
			event.cookies.delete('__session', { path: '/' });
		}
	}

	return resolve(event);
};
