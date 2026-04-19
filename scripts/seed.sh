#!/usr/bin/env bash
# Seed a demo user + assistant + token into the Firebase emulator.
# Useful for local smoke testing the public /v1 API.

set -euo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

PROJECT_ID="${ADMIN_PROJECT_ID:-prompt-to-api}"
export FIRESTORE_EMULATOR_HOST="${FIRESTORE_EMULATOR_HOST:-localhost:9231}"
export FIREBASE_AUTH_EMULATOR_HOST="${FIREBASE_AUTH_EMULATOR_HOST:-localhost:9230}"

echo "Seeding demo data into project '$PROJECT_ID'..."

node --experimental-vm-modules - <<'NODE'
import('firebase-admin/app').then(async ({ initializeApp, cert }) => {
	const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
	const { getAuth } = await import('firebase-admin/auth');
	const shared = await import('./shared/src/index.ts').catch(async () => {
		// runtime fallback if TS loader isn't present
		const crypto = await import('./shared/src/crypto.ts');
		const tokens = await import('./shared/src/tokens.ts');
		return { ...crypto, ...tokens };
	});

	initializeApp({ projectId: process.env.ADMIN_PROJECT_ID || 'prompt-to-api' });
	const db = getFirestore();
	const auth = getAuth();

	const email = 'demo@prompt-to-api.test';
	const user = await auth.getUserByEmail(email).catch(async () => {
		return auth.createUser({ email, password: 'demo-password-1234', displayName: 'Demo User' });
	});
	const uid = user.uid;
	console.log('user uid =', uid);

	await db.collection('users').doc(uid).set({
		uid,
		email,
		displayName: 'Demo User',
		createdAt: Date.now()
	}, { merge: true });

	// Dummy provider key (won't work against real APIs).
	const keyDoc = shared.encryptProviderKey('anthropic', 'sk-ant-demo-not-real');
	await db.collection('users').doc(uid).collection('providerKeys').doc('anthropic').set(keyDoc);

	// Assistant.
	const assistantRef = db.collection('users').doc(uid).collection('assistants').doc('demo');
	await assistantRef.set({
		id: 'demo',
		name: 'Demo Assistant',
		slug: 'demo',
		systemPrompt: 'You are a friendly demo assistant.',
		provider: 'anthropic',
		model: 'claude-sonnet-4-6',
		temperature: 0.7,
		maxTokens: 1024,
		publicSpec: true,
		createdAt: Date.now(),
		updatedAt: Date.now()
	});

	// Token.
	const { plaintext, tokenHash, lastFour } = shared.generateApiToken();
	const tokenRef = assistantRef.collection('tokens').doc();
	const tokenDoc = {
		tokenHash,
		ownerUid: uid,
		assistantId: 'demo',
		label: 'Seed token',
		lastFour,
		createdAt: Date.now(),
		lastUsedAt: null,
		revokedAt: null
	};
	await tokenRef.set({ ...tokenDoc, id: tokenRef.id });
	await db.collection('apiTokens').doc(tokenHash).set(tokenDoc);

	console.log('\nDemo assistant created!');
	console.log('  Login: demo@prompt-to-api.test / demo-password-1234');
	console.log('  Token (save this): ' + plaintext);
	console.log('  Endpoint: http://localhost:9232/' + (process.env.ADMIN_PROJECT_ID||'prompt-to-api') + '/us-central1/api/v1/assistants/demo/chat');
});
NODE
