// PM2 process definitions for local dev.
//
// Copy to ecosystem.config.cjs (done automatically by `pnpm install` via the
// `prepare` script) and edit as needed. ecosystem.config.cjs is git-ignored.
//
// Naming convention: all PM2 process names are prefixed `prompt-to-api-*`
// so PortIO picks them up (see wf-ports.json).

const path = require('path');
const cwd = __dirname;

module.exports = {
	apps: [
		{
			name: 'prompt-to-api-frontend',
			script: 'pnpm',
			args: 'run dev',
			cwd,
			interpreter: 'none',
			env: {
				PORT: '5260',
				NODE_ENV: 'development',
				PUBLIC_APP_ENV: 'development',
				PUBLIC_USE_EMULATOR: 'true',
				PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: 'http://localhost:9230',
				PUBLIC_FIRESTORE_EMULATOR_HOST: 'localhost:9231',
				// Admin SDK emulator auto-detection:
				FIRESTORE_EMULATOR_HOST: 'localhost:9231',
				FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9230',
				ADMIN_PROJECT_ID: 'prompt-to-api',
				// Web SDK config — replace with real values from `firebase apps:sdkconfig web`.
				PUBLIC_FIREBASE_API_KEY: 'demo-api-key',
				PUBLIC_FIREBASE_AUTH_DOMAIN: 'prompt-to-api.firebaseapp.com',
				PUBLIC_FIREBASE_PROJECT_ID: 'prompt-to-api',
				PUBLIC_FIREBASE_STORAGE_BUCKET: '',
				PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '',
				PUBLIC_FIREBASE_APP_ID: ''
			}
		},
		{
			name: 'prompt-to-api-emulator',
			script: 'firebase',
			args: 'emulators:start --project prompt-to-api --only auth,firestore,functions,ui --import=./emulator-data --export-on-exit=./emulator-data',
			cwd,
			interpreter: 'none',
			env: {
				// Make sure functions runtime uses the dev encryption key (overridable).
				KEY_ENCRYPTION_SECRET:
					'0000000000000000000000000000000000000000000000000000000000000000'
			}
		},
		{
			name: 'prompt-to-api-functions-build',
			script: 'pnpm',
			args: '--filter functions build:watch',
			cwd,
			interpreter: 'none'
		},
		{
			name: 'prompt-to-api-backup',
			script: path.join(cwd, 'scripts/backup-emulator.sh'),
			interpreter: 'bash',
			cwd,
			autorestart: false,
			cron_restart: '*/5 * * * *'
		}
	]
};
