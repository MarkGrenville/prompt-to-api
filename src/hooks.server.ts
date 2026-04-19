import type { Handle } from '@sveltejs/kit';
import { adminAuth } from '$lib/server/admin';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.uid = null;
	event.locals.email = null;

	const session = event.cookies.get('pta_session');
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
			event.cookies.delete('pta_session', { path: '/' });
		}
	}

	return resolve(event);
};
