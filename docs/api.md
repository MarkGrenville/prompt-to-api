# Public `/v1` API

The public API lives in Cloud Functions
([functions/src/api.ts](../functions/src/api.ts)) and is mounted at `/v1/**`
via Firebase Hosting rewrites. External tools (Cursor skills, Claude Code,
custom agents) authenticate with a per-assistant bearer token.

## Base URLs

| Environment | Base URL |
| ----------- | -------- |
| Local emulator | `http://localhost:9232/<projectId>/us-central1/api/v1` |
| Production  | `https://<project>.web.app/v1`  or  `https://<custom-domain>/v1` |

`<projectId>` defaults to `prompt-to-api`.

## Authentication

Every request must include:

```
Authorization: Bearer pta_live_<24 chars>
```

Tokens are created in the dashboard (the first one is generated automatically
when the assistant is created). They are scoped to a single assistant.

Token format:

- Plaintext: `pta_live_<24 base62 chars>`
- Stored: SHA-256 hex of plaintext, in `apiTokens/{hash}`.

## Conversation model

The assistant is **stateful, server-side**. A conversation is an ordered
sequence of `user` / `assistant` messages that the server replays on every
turn, so callers only ever need to send the **new** user message.

Lifecycle:

1. `POST /v1/assistants/{id}/conversations` — create a thread, get `{id}`.
2. `POST /v1/assistants/{id}/conversations/{conversationId}/messages` — append
   one (or more) user message(s), get the assistant reply.
3. `GET /v1/assistants/{id}/conversations/{conversationId}` — replay the full
   transcript (useful to resume from another process).
4. `DELETE /v1/assistants/{id}/conversations/{conversationId}` — drop the thread.

There is also a `POST /v1/assistants/{id}/chat` convenience shortcut for
callers that don't want to track conversation ids — see below.

## Endpoints

### `GET /v1/health`

Unauthenticated health check.

```json
{ "ok": true, "service": "prompt-to-api", "ts": 1744780000000 }
```

### `POST /v1/assistants/{assistantId}/conversations`

Create a new conversation thread.

Request (body optional):

```json
{ "title": "Weekly planning brainstorm" }
```

Response `201`:

```json
{
  "id": "OxIqZ3…",
  "title": "Weekly planning brainstorm",
  "createdAt": 1744780000000,
  "updatedAt": 1744780000000,
  "messageCount": 0,
  "source": "api"
}
```

### `POST /v1/assistants/{assistantId}/conversations/{conversationId}/messages`

Append new user message(s) and receive the assistant reply. The server loads
the existing transcript and includes it as context automatically.

Request:

```json
{
  "messages": [
    { "role": "user", "content": "What should I do next?" }
  ]
}
```

Response `200`:

```json
{
  "conversationId": "OxIqZ3…",
  "message": { "role": "assistant", "content": "…" },
  "usage": { "tokensIn": 321, "tokensOut": 78 }
}
```

### `GET /v1/assistants/{assistantId}/conversations/{conversationId}`

Returns the full transcript with message ids + timestamps. Useful for
resuming from a different machine, displaying history, or auditing.

### `DELETE /v1/assistants/{assistantId}/conversations/{conversationId}`

Deletes the conversation and its messages. `204 No Content` on success.

### `POST /v1/assistants/{assistantId}/chat` *(convenience)*

Stateless-feeling shortcut. Behaviour:

- If `conversationId` is **omitted**, a new conversation is created.
- If `conversationId` is **provided**, messages are appended to it.

Request:

```json
{
  "messages": [{ "role": "user", "content": "Hi" }],
  "conversationId": "optional-existing-id"
}
```

Response `200` — same shape as `/messages`:

```json
{
  "conversationId": "OxIqZ3…",
  "message": { "role": "assistant", "content": "…" },
  "usage": { "tokensIn": 12, "tokensOut": 34 }
}
```

### Error responses (all endpoints)

| Status | Code                          | Meaning                                                  |
| ------ | ----------------------------- | -------------------------------------------------------- |
| 400    | `messages_required`           | Empty or missing `messages` array                        |
| 401    | `missing_bearer_token`        | No `Authorization: Bearer …` header                      |
| 401    | `invalid_token`               | Token hash not found                                     |
| 401    | `token_revoked`               | Token was revoked via the dashboard                      |
| 403    | `token_assistant_mismatch`    | Token belongs to a different assistant                   |
| 404    | `assistant_not_found`         | Assistant was deleted                                    |
| 404    | `conversation_not_found`      | Conversation id doesn't exist for this assistant         |
| 405    | `method_not_allowed`          | Wrong HTTP verb for the path                             |
| 412    | `provider_key_not_configured` | Owner hasn't added a key for this assistant's provider   |
| 500    | `decrypt_failed`              | Server misconfiguration (KEY_ENCRYPTION_SECRET mismatch) |

### `GET /v1/assistants/{assistantId}/openapi.json`

Returns a complete OpenAPI 3.1 document describing the conversation endpoints
for the assistant. Contains operation ids `createConversation`,
`appendMessages`, `getConversation`, `deleteConversation`, and `chat`.

The spec is always public — it only exposes endpoint paths and schemas (no
secrets), and `/docs` serves the same information anyway. The actual data
endpoints stay protected by the bearer token. This means you can hand the
`openapi.json` URL directly to tools like Cursor, ChatGPT Actions, or Postman
without provisioning a shared token. The legacy `publicSpec` flag on the
assistant doc is no longer consulted and will be removed in a future version.

### `GET /v1/assistants/{assistantId}/docs`

Swagger UI rendered against `openapi.json`. Used as the iframe target in the
dashboard's "API & Swagger" tab.

## Skill snippet formats

The dashboard generates four templated snippets per assistant. Each snippet
uses the conversation endpoints so external agents get proper multi-turn
context:

1. **Cursor skill** — `.cursor/skills/<slug>/SKILL.md` with YAML frontmatter
   and instructions to create a conversation once, then append messages.
2. **Claude Code** — Markdown to paste into `CLAUDE.md` or a skill file.
3. **curl** — two-step shell example (create conversation, then append).
4. **OpenAPI tool** — generic JSON descriptor pointing custom loaders at the
   spec URL with a bearer token.

Each is rendered by
[src/routes/app/assistants/[id]/+page.svelte](../src/routes/app/assistants/[id]/+page.svelte).
