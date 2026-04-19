<script lang="ts">
	import { page } from '$app/state';
	import { signOut } from '$lib/firebase-client';
	import { goto } from '$app/navigation';

	let { data, children } = $props();

	const nav = [
		{ href: '/app/assistants', label: 'Assistants', icon: '◇' },
		{ href: '/app/keys', label: 'Provider keys', icon: '⚿' },
		{ href: '/app/settings', label: 'Settings', icon: '⚙' }
	];

	function isActive(href: string) {
		return page.url.pathname === href || page.url.pathname.startsWith(href + '/');
	}

	async function doSignOut() {
		await signOut();
		await goto('/');
	}
</script>

<div class="grid min-h-screen grid-cols-1 md:grid-cols-[240px_1fr]">
	<aside class="hidden border-r border-ink-700/60 bg-ink-900/70 md:flex md:flex-col">
		<a href="/" class="flex items-center gap-2 border-b border-ink-700/60 px-5 py-4 text-sm font-semibold">
			<span class="grid h-6 w-6 place-items-center rounded bg-accent-600 text-xs text-white">P</span>
			Prompt To API
		</a>
		<nav class="flex-1 space-y-1 p-3">
			{#each nav as item}
				<a
					href={item.href}
					class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition {isActive(item.href)
						? 'bg-ink-800 text-white'
						: 'text-neutral-400 hover:bg-ink-800/60 hover:text-white'}"
				>
					<span class="w-4 text-center text-neutral-500">{item.icon}</span>
					{item.label}
				</a>
			{/each}
		</nav>
		<div class="border-t border-ink-700/60 p-3">
			<div class="rounded-lg bg-ink-800/60 p-3">
				<div class="truncate text-xs text-neutral-400">Signed in</div>
				<div class="mt-1 truncate text-sm">{data.email ?? data.uid}</div>
				<button class="btn-ghost mt-2 w-full justify-start text-xs" onclick={doSignOut}>Sign out</button>
			</div>
		</div>
	</aside>

	<!-- Mobile top bar -->
	<header class="flex items-center justify-between border-b border-ink-700/60 px-4 py-3 md:hidden">
		<a href="/" class="flex items-center gap-2 text-sm font-semibold">
			<span class="grid h-6 w-6 place-items-center rounded bg-accent-600 text-xs text-white">P</span>
			Prompt To API
		</a>
		<nav class="flex gap-3 text-sm text-neutral-300">
			<a href="/app/assistants" class:text-white={isActive('/app/assistants')}>Assistants</a>
			<a href="/app/keys" class:text-white={isActive('/app/keys')}>Keys</a>
			<button onclick={doSignOut} class="text-neutral-400">Sign out</button>
		</nav>
	</header>

	<main class="min-h-0">
		<div class="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
			{@render children()}
		</div>
	</main>
</div>
