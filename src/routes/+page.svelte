<script lang="ts">
	import { goto } from '$app/navigation';
	let { data } = $props();

	const features = [
		{
			title: 'Any LLM',
			body: 'Bring your own Anthropic, OpenAI or Gemini key. Switch models per assistant.'
		},
		{
			title: 'One prompt → one API',
			body: 'Write a system prompt, get a bearer-authenticated /v1/chat endpoint instantly.'
		},
		{
			title: 'Swagger + skill snippet',
			body: 'Auto-generated OpenAPI 3.1 and a copy-paste snippet that teaches the skill to Cursor or Claude Code.'
		}
	];

	const steps = [
		{ n: 1, title: 'Create an assistant', body: 'Paste your system prompt, pick a provider and model.' },
		{ n: 2, title: 'Get your OpenAPI URL + token', body: 'The first bearer token is generated for you automatically.' },
		{
			n: 3,
			title: 'Teach it as a skill',
			body: 'Drop the generated snippet into .cursor/skills/ or Claude Code. Done.'
		}
	];

	const reviews = [
		{
			name: 'Sasha K.',
			role: 'Indie founder',
			quote:
				'My "brand voice" prompt is now an API. My landing-page generator calls it before writing copy. Magic.'
		},
		{
			name: 'Dani M.',
			role: 'ML engineer',
			quote:
				'I spin up a "product manager" persona and a "critical reviewer" persona and have my main agent consult both. 15 seconds to wire.'
		},
		{
			name: 'Theo R.',
			role: 'Design systems lead',
			quote:
				'Turned our design principles doc into an API. Every PR that touches UI now gets a review by the "principles" assistant.'
		}
	];
</script>

<svelte:head>
	<title>Prompt To API — turn any system prompt into an authenticated assistant API</title>
	<meta
		name="description"
		content="Paste a system prompt, get an OpenAPI-described, bearer-authenticated assistant API plus a skill snippet for Cursor and Claude Code."
	/>
</svelte:head>

<div class="relative isolate min-h-screen overflow-hidden">
	<!-- Background glow -->
	<div
		class="pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
		aria-hidden="true"
	>
		<div
			class="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-accent-600 to-indigo-300 opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
			style="clip-path: polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%);"
		></div>
	</div>

	<!-- Nav -->
	<header class="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
		<a href="/" class="flex items-center gap-2 text-sm font-semibold tracking-tight">
			<span class="grid h-7 w-7 place-items-center rounded-md bg-accent-600 text-white">P</span>
			Prompt To API
		</a>
		<nav class="flex items-center gap-2 sm:gap-4">
			<a href="#how" class="hidden text-sm text-neutral-300 hover:text-white sm:inline">How it works</a>
			<a href="#reviews" class="hidden text-sm text-neutral-300 hover:text-white sm:inline">Reviews</a>
			<a
				href="https://github.com/"
				target="_blank"
				rel="noreferrer"
				class="hidden text-sm text-neutral-300 hover:text-white sm:inline">GitHub</a
			>
			{#if data.uid}
				<a href="/app" class="btn-primary">Open dashboard</a>
			{:else}
				<a href="/login" class="btn-ghost">Sign in</a>
				<a href="/signup" class="btn-primary">Get started</a>
			{/if}
		</nav>
	</header>

	<!-- Hero -->
	<section class="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-20">
		<div class="mx-auto max-w-3xl text-center">
			<span class="badge border-accent-500/30 bg-accent-500/10 text-accent-400"
				>Free during beta — unlimited assistants</span
			>
			<h1
				class="mt-4 text-4xl font-semibold tracking-tight text-neutral-100 sm:text-6xl"
			>
				Turn any prompt into an <span class="bg-gradient-to-r from-accent-400 to-indigo-300 bg-clip-text text-transparent"
					>assistant API</span
				>.
			</h1>
			<p class="mt-6 text-lg leading-8 text-neutral-300">
				Paste a system prompt. Get a bearer-authenticated <code class="text-accent-400">/chat</code>
				endpoint, an auto-generated OpenAPI spec, and a skill snippet that teaches the assistant
				straight to Cursor or Claude Code.
			</p>
			<div class="mt-8 flex items-center justify-center gap-3">
				<a href={data.uid ? '/app' : '/signup'} class="btn-primary px-6 py-3 text-base"
					>Create your first API →</a
				>
				<a href="#how" class="btn-secondary px-6 py-3 text-base">See how it works</a>
			</div>
			<p class="mt-4 text-xs text-neutral-500">
				BYO Anthropic / OpenAI / Gemini key. Keys stored encrypted with AES-256-GCM, server-only.
			</p>
		</div>

		<!-- Hero code preview -->
		<div class="mx-auto mt-16 max-w-3xl">
			<div class="card overflow-hidden">
				<div class="flex items-center gap-2 border-b border-ink-700 bg-ink-800 px-4 py-2 text-xs text-neutral-400">
					<span class="h-3 w-3 rounded-full bg-red-500/70"></span>
					<span class="h-3 w-3 rounded-full bg-yellow-500/70"></span>
					<span class="h-3 w-3 rounded-full bg-green-500/70"></span>
					<span class="ml-3">.cursor/skills/brand-voice/SKILL.md</span>
				</div>
				<pre class="overflow-x-auto p-4 text-left font-mono text-xs leading-relaxed text-neutral-200"><code>---
name: Brand Voice
description: Our brand's tone of voice. Use when writing any customer-facing copy.
---

Call the assistant at:
  POST https://prompt-to-api.web.app/v1/assistants/brand-voice-8f2/chat
  Authorization: Bearer pta_live_****************AbC9

OpenAPI: https://prompt-to-api.web.app/v1/assistants/brand-voice-8f2/openapi.json
</code></pre>
			</div>
		</div>
	</section>

	<!-- Features -->
	<section class="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
		<div class="grid gap-6 sm:grid-cols-3">
			{#each features as f}
				<div class="card p-6">
					<h3 class="text-base font-semibold text-neutral-100">{f.title}</h3>
					<p class="mt-2 text-sm text-neutral-400">{f.body}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- How it works -->
	<section id="how" class="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
		<h2 class="text-center text-3xl font-semibold tracking-tight">How it works</h2>
		<p class="mx-auto mt-3 max-w-xl text-center text-neutral-400">
			Three steps. No polling, no queues. Request in, response out.
		</p>
		<div class="mt-10 grid gap-4 sm:grid-cols-3">
			{#each steps as s}
				<div class="card p-6">
					<div class="flex h-8 w-8 items-center justify-center rounded-full bg-accent-600/20 font-mono text-sm text-accent-400">
						{s.n}
					</div>
					<h3 class="mt-4 text-base font-semibold">{s.title}</h3>
					<p class="mt-2 text-sm text-neutral-400">{s.body}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- Reviews -->
	<section id="reviews" class="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
		<h2 class="text-center text-3xl font-semibold tracking-tight">What early users are doing with it</h2>
		<div class="mt-10 grid gap-4 sm:grid-cols-3">
			{#each reviews as r}
				<figure class="card p-6">
					<blockquote class="text-sm text-neutral-200">“{r.quote}”</blockquote>
					<figcaption class="mt-4 text-xs text-neutral-500">{r.name} · {r.role}</figcaption>
				</figure>
			{/each}
		</div>
	</section>

	<!-- Urgency / CTA -->
	<section class="mx-auto max-w-4xl px-4 pb-20 sm:px-6">
		<div
			class="card relative overflow-hidden p-8 text-center sm:p-12"
		>
			<div
				class="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-accent-600/10 via-transparent to-indigo-400/10"
			></div>
			<span class="badge border-accent-500/30 bg-accent-500/10 text-accent-400">Beta</span>
			<h2 class="mt-4 text-3xl font-semibold tracking-tight">Free while in beta.</h2>
			<p class="mx-auto mt-3 max-w-xl text-neutral-400">
				Spin up unlimited assistants and API tokens while we ship v1. Pricing will apply after launch —
				everything you create now stays on your account.
			</p>
			<a href={data.uid ? '/app' : '/signup'} class="btn-primary mt-6 px-6 py-3 text-base"
				>Claim your free account</a
			>
		</div>
	</section>

	<!-- Footer -->
	<footer class="border-t border-ink-700/50">
		<div class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-neutral-500 sm:flex-row sm:px-6">
			<div>© {new Date().getFullYear()} Prompt To API — Open source.</div>
			<nav class="flex gap-5">
				<a href="#how" class="hover:text-neutral-200">How it works</a>
				<a href="/login" class="hover:text-neutral-200">Sign in</a>
				<a href="https://github.com/" class="hover:text-neutral-200">GitHub</a>
				<a href="/privacy" class="hover:text-neutral-200">Privacy</a>
				<a href="/terms" class="hover:text-neutral-200">Terms</a>
			</nav>
		</div>
	</footer>
</div>
