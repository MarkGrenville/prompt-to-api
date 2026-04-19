# Prompt To API

> Give your AI agents specialists to call.

You write a system prompt. Prompt To API gives you a bearer-authenticated HTTPS endpoint, an auto-generated OpenAPI 3.1 spec, and a copy-paste **skill snippet** so Cursor or Claude Code can consult that assistant on demand — with full conversation memory, no glue code.

**Live:** https://prompt-to-api.web.app

## Why

When you're working with an AI coding agent, you often want it to defer to a specialist before it acts:

- A **brand-voice editor** before it writes any customer-facing copy
- A **product manager** that pushes back on under-specified tickets
- A **security reviewer** before it touches auth code
- A **principal engineer** for second opinions on tricky tradeoffs

Today you cram all of that into one giant system prompt and hope for the best. With Prompt To API each persona becomes its own HTTPS endpoint your main agent can call as a tool — and you can iterate on each persona independently without rewriting your entire setup.

## What you get per assistant

| Endpoint | Purpose |
| --- | --- |
| `POST /v1/assistants/{id}/conversations` | Start a thread, get a `conversationId` |
| `POST /v1/assistants/{id}/conversations/{convId}/messages` | Append a turn — server replays prior context |
| `GET  /v1/assistants/{id}/conversations/{convId}` | Read the full transcript |
| `POST /v1/assistants/{id}/chat` | Stateless one-shot for callers that don't need memory |
| `GET  /v1/assistants/{id}/openapi.json` | Auto-generated OpenAPI 3.1 spec |
| `GET  /v1/assistants/{id}/docs` | Swagger UI |

Plus, in the dashboard:

- A **bearer token** shown once at creation (only the SHA-256 hash is stored)
- A **skill snippet** for Cursor or Claude Code with URL, token, and usage docs baked in — drop it into `.cursor/skills/<name>/SKILL.md` and your agent knows the rest
- An in-dashboard **Chat** tab that hits the exact same backend so you can sanity-check behaviour before any external call

## Highlights

- **Bring your own key.** Anthropic, OpenAI, or Gemini. Pick provider + model per assistant.
- **Keys encrypted at rest** with AES-256-GCM. Never returned to the browser, decrypted only inside server routes / Cloud Functions.
- **Tokens are hashed.** Plaintext is shown to the user once and then discarded.
- **Stateful conversations.** Context lives server-side so callers only ever send the new turn.
- **One code path.** Dashboard chat and the public `/v1` API both route through `shared/src/chat-core.ts`. If the dashboard works, the API works.
- **Dark, minimal UI.** SvelteKit 2 + Svelte 5 + Tailwind. No component library, no theme toggle.

## Stack

- **Frontend**: SvelteKit 2 / Svelte 5, Tailwind CSS
- **Backend**: Firebase Auth (Email + Google), Firestore, Cloud Functions (also serves SSR)
- **Workspace**: pnpm (`shared/`, `functions/`, root SvelteKit app)
- **Local dev**: PM2 + Firebase emulators

## Quick start (local)

```bash
pnpm install
firebase login                        # one-time
firebase use prompt-to-api            # or your own project id
pm2 start ecosystem.config.cjs        # frontend + emulators + functions watcher
open http://localhost:5260
```

The Firebase emulators accept any Google identity locally, so you can sign up with one click. Full walkthrough: [docs/quickstart.md](docs/quickstart.md).

## Documentation

- [docs/quickstart.md](docs/quickstart.md) — zero to "Cursor calls my assistant"
- [docs/api.md](docs/api.md) — public `/v1` API reference and error codes
- [docs/models.md](docs/models.md) — Firestore collections, TS types, token + encryption scheme
- [docs/setup.md](docs/setup.md) — install and first-run details
- [AGENTS.md](AGENTS.md) — guide for AI agents maintaining this repo

## Ports

See [wf-ports.json](wf-ports.json). Frontend at `5260`; Firebase emulators at `9230–9234`.

## License

MIT (intended). Add a `LICENSE` file before going fully open source.
