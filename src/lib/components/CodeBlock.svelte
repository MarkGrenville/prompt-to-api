<script lang="ts">
	let { code, language = 'bash', filename } = $props<{ code: string; language?: string; filename?: string }>();
	let copied = $state(false);

	async function copy() {
		await navigator.clipboard.writeText(code);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<div class="card overflow-hidden">
	<div class="flex items-center justify-between border-b border-ink-700 bg-ink-800 px-3 py-1.5 text-xs text-neutral-400">
		<span class="font-mono">{filename ?? language}</span>
		<button type="button" class="btn-ghost px-2 py-0.5 text-[11px]" onclick={copy}>
			{copied ? 'Copied!' : 'Copy'}
		</button>
	</div>
	<pre class="overflow-x-auto p-3 font-mono text-[12px] leading-relaxed text-neutral-200"><code>{code}</code></pre>
</div>
