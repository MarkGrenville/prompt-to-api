<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	let { data } = $props();

	type ProviderId = 'anthropic' | 'openai' | 'gemini';
	const providers: { id: ProviderId; name: string; hint: string }[] = [
		{ id: 'anthropic', name: 'Anthropic', hint: 'sk-ant-…' },
		{ id: 'openai', name: 'OpenAI', hint: 'sk-…' },
		{ id: 'gemini', name: 'Google Gemini', hint: 'AIza…' }
	];

	let values: Record<ProviderId, string> = $state({ anthropic: '', openai: '', gemini: '' });
	let busy: Record<ProviderId, boolean> = $state({ anthropic: false, openai: false, gemini: false });
	let msg: Record<ProviderId, string | null> = $state({ anthropic: null, openai: null, gemini: null });

	async function save(id: ProviderId) {
		busy[id] = true;
		msg[id] = null;
		try {
			const res = await fetch('/api/keys', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ provider: id, apiKey: values[id] })
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				msg[id] = err.error ?? 'Save failed';
			} else {
				msg[id] = 'Saved.';
				values[id] = '';
				await invalidateAll();
			}
		} finally {
			busy[id] = false;
		}
	}

	async function remove(id: ProviderId) {
		busy[id] = true;
		msg[id] = null;
		try {
			const res = await fetch('/api/keys?provider=' + id, { method: 'DELETE' });
			if (!res.ok) msg[id] = 'Delete failed';
			else {
				msg[id] = 'Removed.';
				await invalidateAll();
			}
		} finally {
			busy[id] = false;
		}
	}
</script>

<div>
	<h1 class="text-2xl font-semibold">Provider keys</h1>
	<p class="mt-1 text-sm text-neutral-400">
		Your LLM provider keys are encrypted with AES-256-GCM and stored server-side. They are never sent to
		your browser after saving.
	</p>

	<div class="mt-8 space-y-4">
		{#each providers as p}
			{@const status = data.providerKeys[p.id]}
			<div class="card p-5">
				<div class="flex items-center justify-between gap-4">
					<div>
						<h3 class="font-semibold">{p.name}</h3>
						<p class="text-xs text-neutral-500">
							{status.hasKey
								? `Configured · updated ${new Date(status.updatedAt ?? 0).toLocaleString()}`
								: 'Not configured'}
						</p>
					</div>
					<span class="badge {status.hasKey ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : ''}">
						{status.hasKey ? 'Active' : 'Missing'}
					</span>
				</div>
				<div class="mt-4 flex flex-col gap-2 sm:flex-row">
					<input
						class="input font-mono"
						type="password"
						placeholder={p.hint}
						bind:value={values[p.id]}
						autocomplete="off"
					/>
					<button class="btn-primary" onclick={() => save(p.id)} disabled={busy[p.id] || !values[p.id]}>
						{busy[p.id] ? 'Saving…' : status.hasKey ? 'Replace' : 'Save'}
					</button>
					{#if status.hasKey}
						<button class="btn-danger" onclick={() => remove(p.id)} disabled={busy[p.id]}>Remove</button>
					{/if}
				</div>
				{#if msg[p.id]}
					<p class="mt-2 text-xs text-neutral-400">{msg[p.id]}</p>
				{/if}
			</div>
		{/each}
	</div>
</div>
