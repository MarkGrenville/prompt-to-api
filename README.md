# Prompt To API

Turn a system prompt into an authenticated assistant API in under a minute.

Point your LLM provider key at Prompt To API, write a system prompt, and receive:

- A bearer-authenticated `POST /v1/assistants/:id/chat` endpoint
- An auto-generated OpenAPI 3.1 spec + Swagger UI
- A copy-paste **skill snippet** that teaches the assistant to Cursor or Claude
  Code so your other agents can consult it

Built as an open-source tool so I can spin up "product manager", "critical
reviewer", "brand-voice editor" personas and have my main AI systems call them
via HTTP.

## Stack

- SvelteKit 2 + Svelte 5 (dark-only UI, Tailwind CSS)
- Firebase Auth (Email + Google), Firestore, Cloud Functions
- PNPM workspace (`shared/`, `functions/`), PM2 for local processes
- Bring-your-own key: Anthropic, OpenAI, Gemini

## Quick start

```bash
pnpm install
firebase login            # one-time
firebase use prompt-to-api  # or the ID you created
pm2 start ecosystem.config.cjs
open http://localhost:5260
```

See [docs/quickstart.md](docs/quickstart.md) for the full guided walkthrough.

## Ports

See [wf-ports.json](wf-ports.json). Frontend at `5260`; Firebase emulators at
`9230-9234`.

## License

MIT (intended). Add a `LICENSE` file before going fully open source.
