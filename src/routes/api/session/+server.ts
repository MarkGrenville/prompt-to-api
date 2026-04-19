import type { RequestHandler } from './$types';
import { adminAuth, adminDb } from '$lib/server/admin';
import { json } from '@sveltejs/kit';

// Session cookie expiry (5 days).
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

export const POST: RequestHandler = async ({ request, cookies }) => {
	const { idToken } = (await request.json()) as { idToken?: string };
	if (!idToken) return json({ error: 'id_token_required' }, { status: 400 });

	let sessionCookie: string;
	let decoded: { uid: string; email?: string | null; name?: string };
	try {
		decoded = await adminAuth.verifyIdToken(idToken, true);
	} catch (err) {
		console.error('[session] verifyIdToken failed', err);
		return json({ error: 'invalid_id_token' }, { status: 401 });
	}

	try {
		sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: FIVE_DAYS_MS });
	} catch (err) {
		// Emulator doesn't implement createSessionCookie — fall back to storing
		// the raw ID token (hooks.server.ts handles both).
		console.warn('[session] createSessionCookie unavailable, using ID token fallback');
		sessionCookie = idToken;
	}

	cookies.set('pta_session', sessionCookie, {
		path: '/',
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		maxAge: Math.floor(FIVE_DAYS_MS / 1000)
	});

	// Upsert user profile.
	try {
		const userRef = adminDb.collection('users').doc(decoded.uid);
		const snap = await userRef.get();
		if (!snap.exists) {
			await userRef.set({
				uid: decoded.uid,
				email: decoded.email ?? null,
				displayName: decoded.name ?? null,
				createdAt: Date.now()
			});
			console.log('[session] new user', decoded.uid);
		}
	} catch (err) {
		console.warn('[session] user profile upsert failed', err);
	}

	return json({ ok: true, uid: decoded.uid });
};

export const DELETE: RequestHandler = async ({ cookies }) => {
	cookies.delete('pta_session', { path: '/' });
	return json({ ok: true });
};
