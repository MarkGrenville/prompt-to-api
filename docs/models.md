# Data models & interfaces

This document is the source of truth for the data shapes exchanged between the
frontend, SvelteKit server routes, Cloud Functions, and Firestore. TypeScript
types live in [shared/src/types.ts](../shared/src/types.ts).

## Firestore collections

```
users/{uid}                                                     UserProfile
users/{uid}/providerKeys/{provider}                             EncryptedProviderKey   (server-only)
users/{uid}/assistants/{assistantId}                            AssistantDoc
users/{uid}/assistants/{assistantId}/tokens/{tId}               ApiTokenDoc            (owner-visible)
users/{uid}/assistants/{assistantId}/conversations/{cId}        ConversationDoc
users/{uid}/assistants/{assistantId}/conversations/{cId}/messages/{mId}  PersistedMessage
apiTokens/{sha256(token)}                                       ApiTokenDoc            (server-only)
```

## Types

### `UserProfile`

```ts
interface UserProfile {
	uid: string;
	email: string | null;
	displayName: string | null;
	createdAt: number; // ms since epoch
}
```

Created on first sign-in by `/api/session` (SvelteKit).

### `EncryptedProviderKey`

```ts
interface EncryptedProviderKey {
	provider: 'anthropic' | 'openai' | 'gemini';
	ciphertext: string; // base64 AES-256-GCM
	iv: string; // base64 12-byte IV
	authTag: string; // base64 16-byte auth tag
	updatedAt: number;
}
```

- Encrypted with `KEY_ENCRYPTION_SECRET` (32-byte hex) using AES-256-GCM.
- Firestore rules deny all client reads/writes — only SvelteKit server routes
  and Cloud Functions can read these.

### `AssistantDoc`

```ts
interface AssistantDoc {
	id: string;
	name: string;
	slug: string; // "<slugified-name>-<6-char-id>"
	systemPrompt: string;
	provider: 'anthropic' | 'openai' | 'gemini';
	model: string; // e.g. "claude-sonnet-4-5-20250929"
	temperature: number; // 0..2
	maxTokens: number; // 16..32_000
	publicSpec: boolean; // if true, OpenAPI spec fetchable without token
	createdAt: number;
	updatedAt: number;
}
```

### `ApiTokenDoc`

```ts
interface ApiTokenDoc {
	tokenHash: string; // SHA-256 hex of plaintext
	ownerUid: string;
	assistantId: string;
	label: string;
	lastFour: string; // last 4 chars of plaintext, for UI display
	createdAt: number;
	lastUsedAt: number | null;
	revokedAt: number | null;
}
```

Stored twice:
- `users/{uid}/assistants/{aid}/tokens/{tid}` — so the owner can list/revoke them
  from the dashboard without server-admin access.
- `apiTokens/{tokenHash}` — top-level index used by Cloud Functions to
  authenticate incoming requests in O(1) by `sha256(Authorization header)`.

Plaintext format: `pta_live_<24 random base62 chars>`. Shown to the user once
at creation time only; not persisted anywhere after creation.

### `ConversationDoc` + `PersistedMessage`

```ts
interface ConversationDoc {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
	messageCount: number;
	source: 'dashboard' | 'api';
}

interface PersistedMessage extends ChatMessage {
	id: string;
	tokensIn?: number;
	tokensOut?: number;
	createdAt: number;
}

interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}
```

> `ChatDoc` is kept as a deprecated type alias of `ConversationDoc` for one
> release; new code should import `ConversationDoc`.

### Model picker

`shared/src/types.ts` also exposes `MODELS_BY_PROVIDER`, a curated list of
suggested models per provider that powers the model dropdown in the
"Create assistant" dialog. Users can always type a custom model id — the
backend doesn't reject unknown values because providers rename/release
models frequently.

## HTTP interfaces

### Public API (Cloud Functions, under `/v1`)

See [api.md](api.md) for detailed shapes. Summary:

- `POST /v1/assistants/:id/conversations` — create thread
- `POST /v1/assistants/:id/conversations/:convId/messages` — append + generate reply
- `GET  /v1/assistants/:id/conversations/:convId` — replay transcript
- `DELETE /v1/assistants/:id/conversations/:convId` — delete thread
- `POST /v1/assistants/:id/chat` — one-shot convenience (auto-creates a conversation)
- `GET  /v1/assistants/:id/openapi.json` — OpenAPI 3.1 JSON
- `GET  /v1/assistants/:id/docs` — Swagger UI HTML

### Internal API (SvelteKit server routes)

Authenticated via `__session` cookie (set by `/api/session`). The cookie is
deliberately named `__session` because Firebase Hosting strips every other
cookie at the CDN edge before forwarding requests to Cloud Functions /
Cloud Run. JSON:

| Route                                    | Methods       | Purpose                                       |
| ---------------------------------------- | ------------- | --------------------------------------------- |
| `/api/session`                           | POST, DELETE  | Exchange ID token for session cookie / sign out |
| `/api/keys`                              | POST, DELETE  | Save/remove a provider key (encrypted)        |
| `/api/assistants`                        | POST          | Create assistant (auto-generates first token) |
| `/api/assistants/:id`                    | PATCH, DELETE | Update or delete an assistant                 |
| `/api/assistants/:id/conversations`      | GET, POST     | List or create dashboard conversations        |
| `/api/assistants/:id/conversations/:c`   | GET, DELETE   | Replay or delete a conversation               |
| `/api/assistants/:id/conversations/:c/messages` | POST   | Dashboard-side send (same chat-core as /v1)   |
| `/api/assistants/:id/tokens`             | POST          | Create additional token                       |
| `/api/assistants/:id/tokens/:tokenId`    | DELETE        | Revoke token                                  |
