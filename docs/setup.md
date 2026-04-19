# Setup

## Prerequisites

- Node.js 22+
- pnpm 10+
- Firebase CLI (`npm i -g firebase-tools`)
- PM2 (`npm i -g pm2`)

## Install

```bash
cd /Users/markgrenville/Projects/prompt-to-api
pnpm install
# The `prepare` script creates ecosystem.config.cjs from the example if missing.
```

## Firebase project

One-off, so the emulators have a stable project ID:

```bash
firebase login
firebase projects:create prompt-to-api   # or pick another unique ID
firebase use prompt-to-api
```

If you used a different project ID, update:

- [.firebaserc](../.firebaserc) `projects.default`
- [wf-ports.json](../wf-ports.json) `firebaseProjectId`
- [ecosystem.config.cjs](../ecosystem.config.cjs) `ADMIN_PROJECT_ID` env var

### Firebase web SDK config

Once the project exists:

```bash
firebase apps:create WEB "Prompt To API" --project prompt-to-api
firebase apps:sdkconfig WEB --project prompt-to-api
```

Fill the values into `.env` (copy from `.env.example`) **and** into the
`PUBLIC_FIREBASE_*` env block in `ecosystem.config.cjs` so PM2 passes them to
the dev server.

### Auth providers

The Firebase emulator provides Email/Password and Google automatically with no
extra setup. For production:

1. Firebase console → Authentication → Sign-in method
2. Enable **Email/Password**
3. Enable **Google** (choose support email)

## Encryption secret

Provider keys are encrypted with AES-256-GCM. Generate a real key for
production:

```bash
openssl rand -hex 32
```

Set it in `.env` as `KEY_ENCRYPTION_SECRET`. The functions runtime reads this
from the same secret in Google Cloud; declare it via
`firebase functions:secrets:set KEY_ENCRYPTION_SECRET` before deploying.

For local dev, leaving it blank is fine — the shared crypto module falls back
to a well-known all-zero key and logs a warning.

## Run it

```bash
pm2 start ecosystem.config.cjs
pm2 logs prompt-to-api --lines 100 --nostream
./scripts/check-emulator.sh
```

Open <http://localhost:5260>.

## Seed demo data (optional)

```bash
./scripts/seed.sh
# prints a demo token + endpoint you can curl against /v1
```

## Tear down

```bash
pm2 delete ecosystem.config.cjs
```

## Deployment

```bash
./scripts/deploy.sh
```

The script verifies `firebase use` matches `.firebaserc`, builds SvelteKit +
functions, copies the adapter-node output into `functions/build/`, then runs
`firebase deploy --only hosting,functions,firestore:rules,firestore:indexes`.
It will prompt for `y` before deploying.

**Never** run `deploy.sh` unless explicitly asked by the user.
