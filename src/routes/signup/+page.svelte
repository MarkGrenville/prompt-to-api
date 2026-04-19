<script lang="ts">
	import { goto } from '$app/navigation';
	import { signUpEmail, signInGoogle } from '$lib/firebase-client';

	let email = $state('');
	let password = $state('');
	let error = $state<string | null>(null);
	let loading = $state(false);

	async function submit(e: Event) {
		e.preventDefault();
		error = null;
		loading = true;
		try {
			await signUpEmail(email, password);
			await goto('/app');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Sign-up failed';
			console.error('[signup] email signup failed', err);
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
			console.error('[signup] google failed', err);
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
			<h1 class="text-2xl font-semibold">Create account</h1>
			<p class="mt-1 text-sm text-neutral-400">Free during beta. No credit card.</p>

			<button type="button" class="btn-secondary mt-6 w-full" onclick={google} disabled={loading}>
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
					<input
						id="password"
						type="password"
						required
						minlength="6"
						bind:value={password}
						class="input mt-1"
					/>
					<p class="mt-1 text-xs text-neutral-500">6+ characters.</p>
				</div>
				{#if error}
					<p class="text-sm text-red-400">{error}</p>
				{/if}
				<button type="submit" class="btn-primary w-full" disabled={loading}>
					{loading ? 'Creating…' : 'Create account'}
				</button>
			</form>

			<p class="mt-6 text-center text-sm text-neutral-400">
				Already have an account? <a href="/login" class="link">Sign in</a>
			</p>
		</div>
	</div>
</div>
