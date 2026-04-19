# Prompt To API — Agent Guide

This repo is primarily maintained by AI (Cursor). Favour clarity for machines:
thorough logging, clear structure, strategic `console.log` in both the frontend
and the backend so errors are visible via `pm2 logs`.

## Elevator pitch

Prompt To API turns a system prompt into a bearer-authenticated HTTPS API with
an auto-generated OpenAPI spec and a one-click "skill snippet" for Cursor /
Claude Code. Users bring their own LLM provider key (Anthropic, OpenAI, Gemini),
define an assistant (choosing a provider + model), and external systems start
conversations against `/v1/assistants/{id}/conversations` and continue them
via `/conversations/{convId}/messages` so context is preserved server-side.
A one-shot `/chat` convenience endpoint also exists for stateless callers.

## Conventions

- **Package manager**: PNPM. There is a pnpm workspace with members `shared/` and
  `functions/`. The root itself is the SvelteKit app.
- **Styling**: Tailwind CSS only. Dark mode is permanent (no toggle). No
  component libraries.
- **Process management**: PM2. Run `Start Full Dev` from `.vscode/tasks.json` or
  `pm2 start ecosystem.config.cjs`. Do not kill ports or use `npm run dev` in a
  way that conflicts with PM2.
- **Deployment**: Never deploy on behalf of the user. Use `scripts/deploy.sh`
  only when the user explicitly asks.
- **Git**: Never run `git init` or commits unless explicitly asked.

## Project structure

```
prompt-to-api/
	src/                    SvelteKit app (landing + /app dashboard + /api routes)
	functions/              Cloud Functions (public /v1 API + SSR wrapper)
	shared/                 Shared chat-core, crypto, tokens, types, OpenAPI builder
	scripts/                backup-emulator, deploy, seed, test-backend, check-emulator
	docs/                   models, api, setup, quickstart, UXGuidelines
```

## Key documentation

- **Data models**: [docs/models.md](docs/models.md) — Firestore collections, TS
  types, token & encryption scheme.
- **Public API**: [docs/api.md](docs/api.md) — `/v1` endpoints, auth header,
  error codes, skill-snippet schema.
- **Setup**: [docs/setup.md](docs/setup.md) — install + first run.
- **Quickstart**: [docs/quickstart.md](docs/quickstart.md) — create an
  assistant and wire it into Cursor.
- **UX guidelines**: [docs/UXGuidelines.md](docs/UXGuidelines.md) — design
  tokens, component inventory, accessibility.

## Ports

Declared in [wf-ports.json](wf-ports.json):

| Service                    | Port  | URL                    |
| -------------------------- | ----- | ---------------------- |
| SvelteKit Dev              | 5260  | http://localhost:5260  |
| SvelteKit Preview          | 5261  | http://localhost:5261  |
| Firebase Auth Emulator     | 9230  | http://localhost:9230  |
| Firestore Emulator         | 9231  | http://localhost:9231  |
| Cloud Functions Emulator   | 9232  | http://localhost:9232  |
| Emulator UI                | 9233  | http://localhost:9233  |
| Emulator Hub               | 9234  | http://localhost:9234  |

PM2 names follow `prompt-to-api-*` (`-frontend`, `-emulator`, `-functions-build`,
`-backup`) so PortIO detects them.

## Running locally

```
pnpm install           # also copies ecosystem.config.example.cjs → ecosystem.config.cjs
pm2 start ecosystem.config.cjs
pm2 logs prompt-to-api --lines 100 --nostream
```

Check everything is healthy:

```
./scripts/check-emulator.sh
curl -s http://localhost:5260/api/health
```

## Flow

```
Browser  →  SvelteKit (5260)      ─┐
                                   ├─ uses firebase-admin (emulator-aware)
                                   └─ Firestore (9231) + Auth (9230)

External →  Cloud Functions `api` (9232) → Firestore + decrypt provider key
tool           → runAssistantChat() → Anthropic / OpenAI / Gemini
```

The single `chat-core` module in [shared/src/chat-core.ts](shared/src/chat-core.ts)
is imported by both the SvelteKit internal conversation endpoints
([src/routes/api/assistants/[id]/conversations/](src/routes/api/assistants/[id]/conversations/))
and the Cloud Functions public endpoint
([functions/src/api.ts](functions/src/api.ts)). This guarantees that chatting in
the dashboard and calling the API produce identical behaviour.

### Conversation lifecycle

Conversations are persisted at
`users/{uid}/assistants/{aid}/conversations/{convId}` with messages in a
`messages/` subcollection. Both the dashboard and `/v1` API follow the same
flow:

1. Create the conversation (`POST /conversations`) — returns `{id}`.
2. Append new messages (`POST /conversations/{id}/messages`) — the server
   loads prior messages, calls the LLM with the full transcript, and stores
   the new user + assistant messages before responding.
3. Replay (`GET /conversations/{id}`) or delete (`DELETE …`) as needed.

The dashboard Chat tab lazily creates a conversation on the first user
message. See
[src/lib/server/conversations.ts](src/lib/server/conversations.ts) for the
shared helpers and note that `functions/src/api.ts` mirrors the same logic
so bundling stays self-contained.

### Model selection

The "Create assistant" dialog presents a provider dropdown (only enabled
for providers with a saved key) **and** a model dropdown scoped to that
provider. Suggested models live in `MODELS_BY_PROVIDER` in
[shared/src/types.ts](shared/src/types.ts). Users can always type a custom
model id via the "Custom model id…" option — the backend does not validate
model names because providers ship new ones constantly.

## Testing

- End-to-end smoke: `./scripts/test-backend.sh`
- Create demo data in emulator: `./scripts/seed.sh`
- Public API directly: hit
  `http://localhost:9232/prompt-to-api/us-central1/api/v1/health`

## Firebase

- Single project: `prompt-to-api` (see `.firebaserc`).
- Auth providers: Email/Password + Google. Enable in the Firebase console — the
  emulator provides both automatically.
- Cloud Functions need Blaze plan for production deploys.
- Storage is **not** used (out of scope for v1).

## Security model

- `users/{uid}/**` — client SDK access limited to owner.
- `users/{uid}/providerKeys/{provider}` — **server-only** (rules deny all
  client access). Stored ciphertext, decrypted only by Cloud Functions /
  SvelteKit server routes.
- `apiTokens/{sha256}` — top-level, hash-keyed, **server-only**. Plaintext is
  shown to the user once at creation and then discarded.
- `KEY_ENCRYPTION_SECRET` (32 bytes hex) is loaded from env. A dev fallback
  (all zeros) is used in development if the secret is missing; production
  requires the real value.
