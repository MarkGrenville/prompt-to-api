<script lang="ts">
	import CodeBlock from '$lib/components/CodeBlock.svelte';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	type Tab = 'chat' | 'api' | 'tokens' | 'skill' | 'settings';
	let tab = $state<Tab>('chat');

	// --- Chat tab -------------------------------------------------------------
	// We maintain a persisted conversation server-side — the first message
	// creates the conversation lazily, subsequent messages append to it. This
	// matches exactly what external API callers do via /v1/conversations.
	let messages = $state<{ role: 'user' | 'assistant'; content: string }[]>([]);
	let input = $state('');
	let chatBusy = $state(false);
	let chatError = $state<string | null>(null);
	let conversationId = $state<string | null>(null);

	async function ensureConversation(): Promise<string> {
		if (conversationId) return conversationId;
		const res = await fetch(`/api/assistants/${data.assistant.id}/conversations`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({})
		});
		if (!res.ok) throw new Error('Could not start conversation');
		const body = await res.json();
		conversationId = body.id as string;
		return conversationId;
	}

	async function sendChat() {
		if (!input.trim()) return;
		const userMsg = { role: 'user' as const, content: input.trim() };
		const outgoing = [userMsg];
		messages = [...messages, userMsg];
		input = '';
		chatBusy = true;
		chatError = null;
		try {
			const convId = await ensureConversation();
			const res = await fetch(
				`/api/assistants/${data.assistant.id}/conversations/${convId}/messages`,
				{
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ messages: outgoing })
				}
			);
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				chatError = body.error ?? 'Chat failed';
				return;
			}
			const body = await res.json();
			messages = [...messages, { role: 'assistant', content: body.message.content }];
		} catch (e) {
			chatError = e instanceof Error ? e.message : 'Chat failed';
		} finally {
			chatBusy = false;
		}
	}

	function newConversation() {
		conversationId = null;
		messages = [];
		chatError = null;
	}

	// --- Tokens tab -----------------------------------------------------------
	let newLabel = $state('');
	let newPlaintext = $state<string | null>(null);
	let tokenBusy = $state(false);

	async function createToken() {
		tokenBusy = true;
		newPlaintext = null;
		try {
			const res = await fetch(`/api/assistants/${data.assistant.id}/tokens`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ label: newLabel || 'Token' })
			});
			if (res.ok) {
				const body = await res.json();
				newPlaintext = body.plaintext;
				newLabel = '';
				await invalidateAll();
			}
		} finally {
			tokenBusy = false;
		}
	}

	async function revoke(tokenId: string) {
		if (!confirm('Revoke this token? External systems using it will stop working.')) return;
		await fetch(`/api/assistants/${data.assistant.id}/tokens/${tokenId}`, { method: 'DELETE' });
		await invalidateAll();
	}

	// --- Skill snippet tab ----------------------------------------------------
	let skillTab = $state<'cursor' | 'claude' | 'curl' | 'openapi'>('cursor');
	let convBase = $derived(`${data.publicApiBase}/assistants/${data.assistant.id}/conversations`);
	let chatUrl = $derived(`${data.publicApiBase}/assistants/${data.assistant.id}/chat`);
	let specUrl = $derived(`${data.publicApiBase}/assistants/${data.assistant.id}/openapi.json`);
	let docsUrl = $derived(`${data.publicApiBase}/assistants/${data.assistant.id}/docs`);
	let tokenForDisplay = $derived(
		data.tokenOnce ?? newPlaintext ?? `pta_live_…${data.tokens[0]?.lastFour ?? '****'}`
	);
	let hasRealToken = $derived(Boolean(data.tokenOnce || newPlaintext));

	let cursorSkill = $derived(
		`---
name: ${data.assistant.name}
description: ${data.assistant.systemPrompt.split('\n')[0].slice(0, 240)}
---

Use this skill when you need input from the "${data.assistant.name}" assistant.

This assistant is conversational — state is maintained server-side. Start a
thread once, then keep appending messages to the same conversation so the
assistant has full context.

1. Start a conversation (do this once per task/thread):

       curl -X POST "${convBase}" \\
         -H "Authorization: Bearer ${tokenForDisplay}" \\
         -H "Content-Type: application/json" \\
         -d '{}'

   The response looks like \`{ "id": "<conversationId>", ... }\`. Remember the id.

2. Send each new user message to that conversation:

       curl -X POST "${convBase}/<conversationId>/messages" \\
         -H "Authorization: Bearer ${tokenForDisplay}" \\
         -H "Content-Type: application/json" \\
         -d '{"messages":[{"role":"user","content":"<your question>"}]}'

   The response is \`{ conversationId, message: { role, content }, usage }\`.
   Treat \`message.content\` as the assistant's reply.

For one-shot / stateless use, \`POST ${chatUrl}\` still works and auto-creates
a conversation — inspect \`conversationId\` in the response if you want to continue later.

OpenAPI spec: ${specUrl}
Swagger UI:   ${docsUrl}
`
	);

	let claudeSkill = $derived(
		`You have access to an external assistant called "${data.assistant.name}".

The assistant keeps conversation state server-side. For any task where you'll
send multiple messages, create one conversation up-front and reuse its id:

    CID=$(curl -s -X POST "${convBase}" \\
      -H "Authorization: Bearer ${tokenForDisplay}" \\
      -H "Content-Type: application/json" -d '{}' | jq -r .id)

Then for each turn:

    curl -X POST "${convBase}/$CID/messages" \\
      -H "Authorization: Bearer ${tokenForDisplay}" \\
      -H "Content-Type: application/json" \\
      -d '{"messages":[{"role":"user","content":"<your question>"}]}'

Parse \`.message.content\` from the JSON response and quote it back to the user.

Full schema: ${specUrl}
`
	);

	let curlSnippet = $derived(
		`# 1) Create a conversation
CID=$(curl -s -X POST "${convBase}" \\
  -H "Authorization: Bearer ${tokenForDisplay}" \\
  -H "Content-Type: application/json" -d '{}' | jq -r .id)

# 2) Send a message
curl -X POST "${convBase}/$CID/messages" \\
  -H "Authorization: Bearer ${tokenForDisplay}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [
      { "role": "user", "content": "Hello, ${data.assistant.name}!" }
    ]
  }'`
	);

	let openapiSnippet = $derived(
		JSON.stringify(
			{
				name: data.assistant.name,
				openapi_url: specUrl,
				authentication: {
					type: 'bearer',
					token: tokenForDisplay
				}
			},
			null,
			2
		)
	);

	// --- Settings tab ---------------------------------------------------------
	let settingsName = $state(data.assistant.name);
	let settingsPrompt = $state(data.assistant.systemPrompt);
	let settingsModel = $state(data.assistant.model);
	let settingsTemp = $state(data.assistant.temperature);
	let settingsMax = $state(data.assistant.maxTokens);
	let settingsBusy = $state(false);
	let settingsMsg = $state<string | null>(null);

	async function saveSettings() {
		settingsBusy = true;
		settingsMsg = null;
		try {
			const res = await fetch(`/api/assistants/${data.assistant.id}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					name: settingsName,
					systemPrompt: settingsPrompt,
					model: settingsModel,
					temperature: Number(settingsTemp),
					maxTokens: Number(settingsMax)
				})
			});
			settingsMsg = res.ok ? 'Saved.' : 'Save failed.';
			if (res.ok) await invalidateAll();
		} finally {
			settingsBusy = false;
		}
	}

	async function deleteAssistant() {
		if (!confirm(`Delete "${data.assistant.name}" and revoke all its tokens? This cannot be undone.`)) return;
		const res = await fetch(`/api/assistants/${data.assistant.id}`, { method: 'DELETE' });
		if (res.ok) window.location.href = '/app/assistants';
	}

	// Show initial token panel automatically after creation.
	if (data.tokenOnce) tab = 'skill';
</script>

<div>
	<a href="/app/assistants" class="text-sm text-neutral-400 hover:text-white">← All assistants</a>
	<div class="mt-2 flex flex-wrap items-center gap-3">
		<h1 class="text-2xl font-semibold">{data.assistant.name}</h1>
		<span class="badge">{data.assistant.provider}</span>
		<span class="badge font-mono text-[10px]">{data.assistant.model}</span>
	</div>

	{#if data.tokenOnce}
		<div class="card mt-6 border-accent-500/30 bg-accent-500/5 p-5">
			<h3 class="font-semibold text-accent-300">Your initial API token</h3>
			<p class="mt-1 text-sm text-neutral-300">
				This is the only time you'll see the full token. Store it somewhere safe or use the "Skill snippet" tab
				to copy it into Cursor/Claude Code right now.
			</p>
			<div class="mt-3">
				<CodeBlock code={data.tokenOnce} language="token" filename="API Token (shown once)" />
			</div>
		</div>
	{/if}

	<!-- Tabs -->
	<nav class="mt-6 flex gap-1 overflow-x-auto border-b border-ink-700">
		{#each [
			{ id: 'chat', label: 'Chat' },
			{ id: 'api', label: 'API & Swagger' },
			{ id: 'tokens', label: 'Tokens' },
			{ id: 'skill', label: 'Skill snippet' },
			{ id: 'settings', label: 'Settings' }
		] as t}
			<button
				onclick={() => (tab = t.id as Tab)}
				class="border-b-2 px-4 py-2.5 text-sm transition {tab === t.id
					? 'border-accent-500 text-white'
					: 'border-transparent text-neutral-400 hover:text-white'}"
			>
				{t.label}
			</button>
		{/each}
	</nav>

	<div class="pt-6">
		{#if tab === 'chat'}
			<div class="mb-3 flex items-center justify-between gap-2 text-xs text-neutral-500">
				<span>
					{#if conversationId}
						Conversation <span class="font-mono text-neutral-400">{conversationId.slice(0, 10)}…</span> · {messages.length} msgs
					{:else}
						No conversation yet — send a message to start one.
					{/if}
				</span>
				<button
					class="rounded border border-ink-700 px-2 py-1 text-neutral-300 transition hover:border-accent-500 hover:text-white"
					onclick={newConversation}
					disabled={!conversationId && messages.length === 0}
				>
					+ New conversation
				</button>
			</div>
			<div class="card flex h-[60vh] flex-col">
				<div class="flex-1 space-y-3 overflow-y-auto p-4">
					{#if messages.length === 0}
						<p class="text-center text-sm text-neutral-500">
							Send a message to test this assistant. Identical to what third-parties get via the API.
						</p>
					{/if}
					{#each messages as m}
						<div class="flex {m.role === 'user' ? 'justify-end' : 'justify-start'}">
							<div
								class="max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm {m.role === 'user'
									? 'bg-accent-600 text-white'
									: 'bg-ink-800 text-neutral-200'}"
							>
								{m.content}
							</div>
						</div>
					{/each}
					{#if chatBusy}
						<div class="flex justify-start">
							<div class="rounded-lg bg-ink-800 px-3 py-2 text-sm text-neutral-400">Thinking…</div>
						</div>
					{/if}
				</div>
				{#if chatError}
					<div class="border-t border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
						{chatError}
					</div>
				{/if}
				<form
					class="flex gap-2 border-t border-ink-700 p-3"
					onsubmit={(e) => {
						e.preventDefault();
						sendChat();
					}}
				>
					<input class="input" placeholder="Ask the assistant…" bind:value={input} />
					<button class="btn-primary" disabled={chatBusy || !input.trim()}>Send</button>
				</form>
			</div>
		{:else if tab === 'api'}
			<div class="space-y-4">
				<div class="card p-5">
					<h3 class="font-semibold">Endpoints</h3>
					<p class="mt-1 text-sm text-neutral-400">
						Conversation-oriented API. Create a thread, then append messages to it so the assistant has full context on every turn.
					</p>
					<div class="mt-3 space-y-2">
						<CodeBlock code={`POST ${convBase}`} filename="Create conversation" />
						<CodeBlock code={`POST ${convBase}/{conversationId}/messages`} filename="Append message" />
						<CodeBlock code={`GET  ${convBase}/{conversationId}`} filename="Replay transcript" />
						<CodeBlock code={`POST ${chatUrl}`} filename="One-shot shortcut (auto-creates conversation)" />
					</div>
				</div>
				<div class="card p-5">
					<h3 class="font-semibold">OpenAPI / Swagger</h3>
					<p class="mt-1 text-sm text-neutral-400">
						Auto-generated OpenAPI 3.1 spec. Point any OpenAPI-compatible tool at the URL below.
					</p>
					<div class="mt-3">
						<CodeBlock code={specUrl} filename="OpenAPI URL" />
					</div>
					<a class="link mt-3 inline-block text-sm" href={docsUrl} target="_blank" rel="noreferrer">
						Open Swagger UI ↗
					</a>
				</div>
				<div class="card overflow-hidden">
					<iframe title="Swagger UI" src={docsUrl} class="h-[65vh] w-full border-0"></iframe>
				</div>
			</div>
		{:else if tab === 'tokens'}
			<div class="space-y-4">
				<div class="card p-5">
					<h3 class="font-semibold">Create a new token</h3>
					<p class="mt-1 text-sm text-neutral-400">
						Tokens let external systems call this assistant's API. The full value is shown only once.
					</p>
					<div class="mt-3 flex flex-col gap-2 sm:flex-row">
						<input class="input" placeholder="Label (e.g. 'my-cursor-machine')" bind:value={newLabel} />
						<button class="btn-primary" onclick={createToken} disabled={tokenBusy}>
							{tokenBusy ? 'Creating…' : 'Create token'}
						</button>
					</div>
					{#if newPlaintext}
						<div class="mt-4">
							<CodeBlock code={newPlaintext} filename="New token (shown once)" />
						</div>
					{/if}
				</div>

				<div class="card divide-y divide-ink-700/60">
					{#each data.tokens as t}
						<div class="flex items-center justify-between gap-4 p-4">
							<div class="min-w-0">
								<div class="flex items-center gap-2">
									<span class="font-medium">{t.label}</span>
									<span class="font-mono text-xs text-neutral-500">····{t.lastFour}</span>
									{#if t.revokedAt}
										<span class="badge border-red-500/30 bg-red-500/10 text-red-300">Revoked</span>
									{/if}
								</div>
								<p class="text-xs text-neutral-500">
									Created {new Date(t.createdAt).toLocaleString()}
									{#if t.lastUsedAt}· last used {new Date(t.lastUsedAt).toLocaleString()}{/if}
								</p>
							</div>
							{#if !t.revokedAt}
								<button class="btn-danger" onclick={() => revoke(t.id)}>Revoke</button>
							{/if}
						</div>
					{/each}
					{#if data.tokens.length === 0}
						<p class="p-6 text-center text-sm text-neutral-500">No tokens yet.</p>
					{/if}
				</div>
			</div>
		{:else if tab === 'skill'}
			<div class="space-y-4">
				{#if !hasRealToken}
					<div class="card border-yellow-500/30 bg-yellow-500/5 p-4 text-sm text-yellow-200">
						Snippets show a masked token because the full value is only available once. Generate a new token
						in the Tokens tab to get a copy-pasteable snippet.
					</div>
				{/if}

				<div class="flex gap-1 overflow-x-auto">
					{#each [
						{ id: 'cursor', label: 'Cursor skill' },
						{ id: 'claude', label: 'Claude Code' },
						{ id: 'curl', label: 'curl' },
						{ id: 'openapi', label: 'OpenAPI tool' }
					] as t}
						<button
							onclick={() => (skillTab = t.id as typeof skillTab)}
							class="rounded-lg px-3 py-1.5 text-xs transition {skillTab === t.id
								? 'bg-ink-800 text-white'
								: 'text-neutral-400 hover:text-white'}"
						>
							{t.label}
						</button>
					{/each}
				</div>

				{#if skillTab === 'cursor'}
					<p class="text-sm text-neutral-400">
						Save as <code class="text-neutral-300">.cursor/skills/{data.assistant.slug}/SKILL.md</code> in your project.
					</p>
					<CodeBlock code={cursorSkill} language="markdown" filename={`.cursor/skills/${data.assistant.slug}/SKILL.md`} />
				{:else if skillTab === 'claude'}
					<p class="text-sm text-neutral-400">
						Paste into <code class="text-neutral-300">CLAUDE.md</code> or a Claude Code skill file.
					</p>
					<CodeBlock code={claudeSkill} language="markdown" filename="CLAUDE.md" />
				{:else if skillTab === 'curl'}
					<p class="text-sm text-neutral-400">Quickly test the API from a terminal.</p>
					<CodeBlock code={curlSnippet} language="bash" filename="terminal" />
				{:else}
					<p class="text-sm text-neutral-400">
						Generic JSON describing the API, token, and OpenAPI URL — useful for custom tool loaders.
					</p>
					<CodeBlock code={openapiSnippet} language="json" filename="tool.json" />
				{/if}
			</div>
		{:else if tab === 'settings'}
			<div class="card space-y-4 p-6">
				<div>
					<label class="label" for="sn">Name</label>
					<input id="sn" class="input mt-1" bind:value={settingsName} />
				</div>
				<div>
					<label class="label" for="sp">System prompt</label>
					<textarea
						id="sp"
						class="input mt-1 min-h-[180px] font-mono text-xs"
						bind:value={settingsPrompt}
					></textarea>
				</div>
				<div class="grid gap-4 sm:grid-cols-3">
					<div>
						<label class="label" for="sm">Model</label>
						<input id="sm" class="input mt-1 font-mono" bind:value={settingsModel} />
					</div>
					<div>
						<label class="label" for="st">Temperature</label>
						<input id="st" type="number" min="0" max="2" step="0.1" class="input mt-1" bind:value={settingsTemp} />
					</div>
					<div>
						<label class="label" for="smx">Max tokens</label>
						<input id="smx" type="number" min="16" max="32000" step="1" class="input mt-1" bind:value={settingsMax} />
					</div>
				</div>
				{#if settingsMsg}<p class="text-sm text-neutral-400">{settingsMsg}</p>{/if}
				<div class="flex justify-between">
					<button class="btn-danger" onclick={deleteAssistant}>Delete assistant</button>
					<button class="btn-primary" onclick={saveSettings} disabled={settingsBusy}>
						{settingsBusy ? 'Saving…' : 'Save changes'}
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>
