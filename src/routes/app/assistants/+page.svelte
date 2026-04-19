<script lang="ts">
	import { goto } from '$app/navigation';
	import { MODELS_BY_PROVIDER, DEFAULT_MODELS, type ProviderId } from '@prompt-to-api/shared/types';
	let { data } = $props();

	let showCreate = $state(false);
	let name = $state('');
	let prompt = $state('');
	let provider = $state<ProviderId>('anthropic');
	let model = $state<string>(DEFAULT_MODELS['anthropic']);
	let customModel = $state('');
	let busy = $state(false);
	let err = $state<string | null>(null);

	// Keep model in sync when provider changes so users don't accidentally ship an
	// Anthropic model id against an OpenAI key.
	$effect(() => {
		const suggested = MODELS_BY_PROVIDER[provider];
		const match = suggested.find((m) => m.id === model);
		if (!match) {
			model = DEFAULT_MODELS[provider];
			customModel = '';
		}
	});

	const modelChoices = $derived([
		...MODELS_BY_PROVIDER[provider].map((m) => ({
			value: m.id,
			label: m.label + (m.hint ? ` — ${m.hint}` : '')
		})),
		{ value: '__custom__', label: 'Custom model id…' }
	]);

	const effectiveModel = $derived(model === '__custom__' ? customModel.trim() : model);

	async function create() {
		err = null;
		busy = true;
		try {
			const res = await fetch('/api/assistants', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					name,
					systemPrompt: prompt,
					provider,
					model: effectiveModel || undefined
				})
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				err = body.error ?? 'Create failed';
				return;
			}
			const body = await res.json();
			await goto(`/app/assistants/${body.id}?showInitialToken=1`);
		} catch (e) {
			err = e instanceof Error ? e.message : 'Create failed';
		} finally {
			busy = false;
		}
	}
</script>

<div class="flex items-center justify-between gap-4">
	<div>
		<h1 class="text-2xl font-semibold">Assistants</h1>
		<p class="mt-1 text-sm text-neutral-400">Each assistant is a system prompt + a bearer-authenticated API.</p>
	</div>
	<button class="btn-primary" onclick={() => (showCreate = true)}>+ New assistant</button>
</div>

{#if data.configuredProviders.length === 0}
	<div class="card mt-6 border-yellow-500/30 bg-yellow-500/5 p-4 text-sm text-yellow-200">
		You haven't added any provider keys yet. <a href="/app/keys" class="link">Add one</a> before creating an assistant.
	</div>
{/if}

<div class="mt-8 grid gap-3">
	{#each data.assistants as a}
		<a
			href={`/app/assistants/${a.id}`}
			class="card flex flex-col gap-2 p-5 transition hover:border-ink-600 sm:flex-row sm:items-center sm:justify-between"
		>
			<div class="min-w-0">
				<div class="flex items-center gap-2">
					<h3 class="truncate font-semibold">{a.name}</h3>
					<span class="badge">{a.provider}</span>
					<span class="badge font-mono text-[10px]">{a.model}</span>
				</div>
				<p class="mt-1 line-clamp-2 text-sm text-neutral-400">{a.systemPrompt}</p>
			</div>
			<div class="text-xs text-neutral-500">
				{new Date(a.createdAt).toLocaleDateString()}
			</div>
		</a>
	{/each}
	{#if data.assistants.length === 0}
		<div class="card p-10 text-center text-neutral-400">
			No assistants yet.
			<button class="link ml-1" onclick={() => (showCreate = true)}>Create one →</button>
		</div>
	{/if}
</div>

{#if showCreate}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
		role="dialog"
		aria-modal="true"
		aria-label="Create assistant"
		onclick={(e) => {
			if (e.target === e.currentTarget) showCreate = false;
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') showCreate = false;
		}}
		tabindex="-1"
	>
		<div class="card w-full max-w-lg p-6" role="document">
			<h2 class="text-lg font-semibold">New assistant</h2>
			<p class="mt-1 text-sm text-neutral-400">
				A bearer-authenticated API will be generated automatically.
			</p>
			<div class="mt-5 space-y-4">
				<div>
					<label class="label" for="aname">Name</label>
					<input id="aname" class="input mt-1" bind:value={name} placeholder="e.g. Brand Voice" />
				</div>
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<label class="label" for="aprov">Provider</label>
						<select id="aprov" class="input mt-1" bind:value={provider}>
							{#each ['anthropic', 'openai', 'gemini'] as id}
								<option
									value={id}
									disabled={!data.configuredProviders.includes(id)}
								>
									{id}
									{#if !data.configuredProviders.includes(id)}(no key configured){/if}
								</option>
							{/each}
						</select>
					</div>
					<div>
						<label class="label" for="amodel">Model</label>
						<select id="amodel" class="input mt-1" bind:value={model}>
							{#each modelChoices as choice}
								<option value={choice.value}>{choice.label}</option>
							{/each}
						</select>
						{#if model === '__custom__'}
							<input
								class="input mt-2 font-mono text-xs"
								placeholder="e.g. claude-opus-4-7"
								bind:value={customModel}
							/>
						{/if}
					</div>
				</div>
				<div>
					<label class="label" for="aprompt">System prompt</label>
					<textarea
						id="aprompt"
						class="input mt-1 min-h-[150px] font-mono text-xs leading-relaxed"
						bind:value={prompt}
						placeholder="You are an expert product manager. When consulted, you..."
					></textarea>
				</div>
				{#if err}<p class="text-sm text-red-400">{err}</p>{/if}
				<div class="flex justify-end gap-2">
					<button class="btn-secondary" onclick={() => (showCreate = false)}>Cancel</button>
					<button
						class="btn-primary"
						onclick={create}
						disabled={busy || !name || !prompt || !effectiveModel || !data.configuredProviders.includes(provider)}
					>
						{busy ? 'Creating…' : 'Create assistant'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
