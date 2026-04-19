import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
	getAuth,
	connectAuthEmulator,
	type Auth,
	GoogleAuthProvider,
	signInWithPopup,
	signInWithEmailAndPassword,
	createUserWithEmailAndPassword,
	signOut as fbSignOut,
	onAuthStateChanged,
	type User
} from 'firebase/auth';
import {
	getFirestore,
	connectFirestoreEmulator,
	type Firestore
} from 'firebase/firestore';
import {
	PUBLIC_FIREBASE_API_KEY,
	PUBLIC_FIREBASE_AUTH_DOMAIN,
	PUBLIC_FIREBASE_PROJECT_ID,
	PUBLIC_FIREBASE_STORAGE_BUCKET,
	PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
	PUBLIC_FIREBASE_APP_ID,
	PUBLIC_USE_EMULATOR,
	PUBLIC_FIREBASE_AUTH_EMULATOR_HOST,
	PUBLIC_FIRESTORE_EMULATOR_HOST
} from '$env/static/public';

const firebaseConfig = {
	apiKey: PUBLIC_FIREBASE_API_KEY || 'demo-api-key',
	authDomain: PUBLIC_FIREBASE_AUTH_DOMAIN || 'demo-prompt-to-api.firebaseapp.com',
	projectId: PUBLIC_FIREBASE_PROJECT_ID || 'prompt-to-api',
	storageBucket: PUBLIC_FIREBASE_STORAGE_BUCKET || '',
	messagingSenderId: PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
	appId: PUBLIC_FIREBASE_APP_ID || ''
};

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

export function firebaseApp(): FirebaseApp {
	if (_app) return _app;
	_app = getApps()[0] ?? initializeApp(firebaseConfig);
	return _app;
}

export function useEmulator(): boolean {
	return String(PUBLIC_USE_EMULATOR ?? '').toLowerCase() === 'true';
}

export function auth(): Auth {
	if (_auth) return _auth;
	_auth = getAuth(firebaseApp());
	if (useEmulator()) {
		const host = PUBLIC_FIREBASE_AUTH_EMULATOR_HOST || 'http://localhost:9230';
		try {
			connectAuthEmulator(_auth, host, { disableWarnings: true });
			console.log('[firebase-client] auth emulator connected', host);
		} catch (e) {
			console.warn('[firebase-client] auth emulator already connected', e);
		}
	}
	return _auth;
}

export function db(): Firestore {
	if (_db) return _db;
	_db = getFirestore(firebaseApp());
	if (useEmulator()) {
		const host = PUBLIC_FIRESTORE_EMULATOR_HOST || 'localhost:9231';
		const [h, p] = host.split(':');
		try {
			connectFirestoreEmulator(_db, h, Number(p));
			console.log('[firebase-client] firestore emulator connected', host);
		} catch (e) {
			console.warn('[firebase-client] firestore emulator already connected', e);
		}
	}
	return _db;
}

export async function signInGoogle(): Promise<User> {
	const provider = new GoogleAuthProvider();
	const result = await signInWithPopup(auth(), provider);
	await establishSession(result.user);
	return result.user;
}

export async function signInEmail(email: string, password: string): Promise<User> {
	const result = await signInWithEmailAndPassword(auth(), email, password);
	await establishSession(result.user);
	return result.user;
}

export async function signUpEmail(email: string, password: string): Promise<User> {
	const result = await createUserWithEmailAndPassword(auth(), email, password);
	await establishSession(result.user);
	return result.user;
}

export async function signOut(): Promise<void> {
	await fbSignOut(auth());
	await fetch('/api/session', { method: 'DELETE' });
}

async function establishSession(user: User): Promise<void> {
	const idToken = await user.getIdToken(true);
	const res = await fetch('/api/session', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ idToken })
	});
	if (!res.ok) {
		console.error('[firebase-client] session create failed', res.status);
		throw new Error('Session failed');
	}
}

export function watchAuth(cb: (user: User | null) => void): () => void {
	return onAuthStateChanged(auth(), cb);
}
