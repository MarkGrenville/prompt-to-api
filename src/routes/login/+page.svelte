<script lang="ts">
	import { goto } from '$app/navigation';
	import { signInEmail, signInGoogle } from '$lib/firebase-client';

	let email = $state('');
	let password = $state('');
	let error = $state<string | null>(null);
	let loading = $state(false);

	async function submit(e: Event) {
		e.preventDefault();
		error = null;
		loading = true;
		try {
			await signInEmail(email, password);
			await goto('/app');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Sign-in failed';
			console.error('[login] email signin failed', err);
		} finally {
			loading = false;
		}
	}

	async function google() {
		error = null;
		loading = true;
		try {
			await signInGoogle();
			await goto('/app');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Google sign-in failed';
			console.error('[login] google failed', err);
		} finally {
			loading = false;
		}
	}
</script>

<div class="flex min-h-screen items-center justify-center px-4">
	<div class="w-full max-w-sm">
		<a href="/" class="mb-6 inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white">
			← Back to home
		</a>
		<div class="card p-8">
			<h1 class="text-2xl font-semibold">Sign in</h1>
			<p class="mt-1 text-sm text-neutral-400">Welcome back. Continue to your dashboard.</p>

			<button type="button" class="btn-secondary mt-6 w-full" onclick={google} disabled={loading}>
				<svg viewBox="0 0 24 24" class="h-4 w-4" aria-hidden="true"
					><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.8-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.1 14.6 2 12 2 6.9 2 2.8 6.1 2.8 11.2S6.9 20.4 12 20.4c6.9 0 9.2-4.8 9.2-7.3 0-.5 0-.9-.1-1.3z"/></svg
				>
				Continue with Google
			</button>

			<div class="my-5 flex items-center gap-3 text-xs uppercase text-neutral-500">
				<span class="h-px flex-1 bg-ink-700"></span>or<span class="h-px flex-1 bg-ink-700"></span>
			</div>

			<form onsubmit={submit} class="space-y-3">
				<div>
					<label for="email" class="label">Email</label>
					<input id="email" type="email" required bind:value={email} class="input mt-1" />
				</div>
				<div>
					<label for="password" class="label">Password</label>
					<input id="password" type="password" required minlength="6" bind:value={password} class="input mt-1" />
				</div>
				{#if error}
					<p class="text-sm text-red-400">{error}</p>
				{/if}
				<button type="submit" class="btn-primary w-full" disabled={loading}>
					{loading ? 'Signing in…' : 'Sign in'}
				</button>
			</form>

			<p class="mt-6 text-center text-sm text-neutral-400">
				New here? <a href="/signup" class="link">Create an account</a>
			</p>
		</div>
	</div>
</div>
