# Quickstart

From zero to "Claude Code / Cursor can talk to my assistant" in five minutes.

## 1. Start locally

```bash
pm2 start ecosystem.config.cjs
open http://localhost:5260
```

## 2. Sign up

Click **Get started**, create an email + password account (or click "Continue
with Google" — the emulator accepts any Google identity locally).

## 3. Add a provider key

- Go to **Provider keys**
- Paste your Anthropic / OpenAI / Gemini key
- Hit **Save**

Your key is encrypted server-side immediately with AES-256-GCM.

## 4. Create an assistant

- **Assistants → + New assistant**
- Name: e.g. "Brand Voice"
- Provider: pick one of the providers whose key you saved
- Model: choose from the dropdown (presets are curated per provider; pick
  "Custom model id…" to type any other model string)
- System prompt: paste whatever role/instructions you want
- **Create**

You'll be redirected to the assistant's detail page with your **initial bearer
token** displayed once. Copy it.

## 5. Wire it into Cursor

On the assistant page, open the **Skill snippet** tab → **Cursor skill**. Copy
the generated Markdown into:

```
<your-project>/.cursor/skills/<assistant-slug>/SKILL.md
```

That's it — Cursor now sees the skill and knows:
- How to create a conversation (`POST /v1/assistants/<id>/conversations`)
- How to append messages (`POST /conversations/<convId>/messages`)
- The bearer token
- The OpenAPI URL for full schema

(Cursor / Claude Code will create one conversation per task and keep reusing
the same id so the assistant retains context across turns.)

Prompt Cursor something like *"Consult the brand-voice assistant for this
copy"* and it will call your API.

## 6. Or wire it into Claude Code

Same tab, switch to **Claude Code**. Paste into `CLAUDE.md` or a Claude Code
skill file.

## 7. Test from the dashboard

The assistant's **Chat** tab talks to the exact same backend as the public API.
If the dashboard chat works, the API will work.

## 8. Test via curl

The **curl** tab gives you a ready-to-paste one-liner.
