import { onRequest } from 'firebase-functions/v2/https';
import { handleApiRequest } from './api.js';

/**
 * Public API entry point.
 *
 * Mounted at `/v1/**` in Firebase Hosting (see firebase.json rewrites). The
 * handler below dispatches to per-assistant routes.
 */
export const api = onRequest(
	{
		region: 'us-central1',
		memory: '512MiB',
		timeoutSeconds: 60,
		maxInstances: 20,
		cors: true,
		invoker: 'public',
		secrets: ['KEY_ENCRYPTION_SECRET']
	},
	async (req, res) => {
		try {
			await handleApiRequest(req, res);
		} catch (err) {
			console.error('[api] unhandled', err);
			if (!res.headersSent) {
				res.status(500).json({ error: 'internal_error' });
			}
		}
	}
);

/**
 * SSR entry point for the SvelteKit dashboard (used only in production hosting
 * deploys). In local dev the dashboard runs on `pnpm dev` (port 5260) so this
 * function is a no-op unless the SvelteKit adapter-node build has been copied
 * into `functions/build/` by `scripts/deploy.sh`.
 */
export const ssr = onRequest(
	{
		region: 'us-central1',
		memory: '512MiB',
		timeoutSeconds: 60,
		maxInstances: 10,
		invoker: 'public',
		secrets: ['KEY_ENCRYPTION_SECRET']
	},
	async (req, res) => {
		try {
			// The SvelteKit adapter-node build is copied to `functions/build/`
			// by scripts/deploy.sh. At runtime the esbuild bundle at
			// `functions/lib/index.js` resolves the sibling `../build/handler.js`.
			// We mark the path as external in esbuild so the SvelteKit handler
			// (and its server chunks under build/server/) load from disk at
			// runtime instead of being inlined into the function bundle.
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore — path only resolves at runtime after deploy copy
			const mod = await import('../build/handler.js').catch((err) => {
				console.warn('[ssr] handler import failed', err);
				return null;
			});
			if (!mod || typeof (mod as { handler?: unknown }).handler !== 'function') {
				res
					.status(503)
					.send(
						'SSR handler not built. Run ./scripts/deploy.sh to copy the SvelteKit build into functions/.'
					);
				return;
			}
			return (mod as { handler: (req: unknown, res: unknown) => unknown }).handler(req, res);
		} catch (err) {
			console.error('[ssr] unhandled', err);
			if (!res.headersSent) res.status(500).send('Internal error');
		}
	}
);
