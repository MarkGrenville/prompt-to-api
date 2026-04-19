<script lang="ts">
	let { data } = $props();
</script>

<div>
	<h1 class="text-2xl font-semibold">Settings</h1>
	<p class="mt-1 text-sm text-neutral-400">Account-level settings.</p>

	<div class="card mt-6 p-6">
		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<div class="label">Email</div>
				<div class="mt-1 text-sm">{data.email ?? '—'}</div>
			</div>
			<div>
				<div class="label">User ID</div>
				<div class="mt-1 font-mono text-xs text-neutral-400">{data.uid}</div>
			</div>
		</div>
	</div>

	<div class="card mt-6 border-ink-700/60 p-6">
		<h2 class="font-semibold">Open source</h2>
		<p class="mt-1 text-sm text-neutral-400">
			Prompt To API is open source. Contributions welcome.
		</p>
		<a class="btn-secondary mt-3" href="https://github.com/" target="_blank" rel="noreferrer">View on GitHub ↗</a>
	</div>
</div>
