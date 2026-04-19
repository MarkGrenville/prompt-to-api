import { onRequest } from 'firebase-functions/v2/https';
import { Readable } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import { handleApiRequest } from './api.js';

// Tell SvelteKit's adapter-node to derive `url.origin` from the forwarded
// headers Firebase Hosting injects, rather than from the Cloud Run internal
// `Host` (which is the ugly `ssr-<hash>-uc.a.run.app`). Without this, any code
// that builds links from `event.url.origin` (e.g. the dashboard's API tab)
// ends up pointing users at the internal run.app hostname.
// Docs: https://svelte.dev/docs/kit/adapter-node#Environment-variables
process.env.PROTOCOL_HEADER = process.env.PROTOCOL_HEADER || 'x-forwarded-proto';
process.env.HOST_HEADER = process.env.HOST_HEADER || 'x-forwarded-host';

/**
 * firebase-functions v2 wraps the request in an Express app whose JSON / urlencoded
 * body parser drains `req` before our handler runs. SvelteKit's `getRequest()`
 * then can't read the body and aborts with a generic 400 "Bad Request". We
 * rebuild the request stream from `req.rawBody` so SvelteKit (and any downstream
 * stream-aware code) can read the body again.
 */
function withReplayableBody(req: IncomingMessage & { rawBody?: Buffer }): IncomingMessage {
	if (!req.rawBody || req.rawBody.length === 0) return req;
	const replay = Readable.from(req.rawBody) as unknown as IncomingMessage;
	// Copy the IncomingMessage surface SvelteKit / polka touch.
	(replay as unknown as Record<string, unknown>).headers = req.headers;
	(replay as unknown as Record<string, unknown>).method = req.method;
	(replay as unknown as Record<string, unknown>).url = req.url;
	(replay as unknown as Record<string, unknown>).httpVersion = req.httpVersion;
	(replay as unknown as Record<string, unknown>).httpVersionMajor = req.httpVersionMajor;
	(replay as unknown as Record<string, unknown>).httpVersionMinor = req.httpVersionMinor;
	(replay as unknown as Record<string, unknown>).socket = req.socket;
	(replay as unknown as Record<string, unknown>).connection = (req as unknown as { connection: unknown }).connection;
	(replay as unknown as Record<string, unknown>).complete = true;
	return replay;
}

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
			const replayReq = withReplayableBody(req as unknown as IncomingMessage & { rawBody?: Buffer });
			return (mod as { handler: (req: unknown, res: unknown) => unknown }).handler(replayReq, res);
		} catch (err) {
			console.error('[ssr] unhandled', err);
			if (!res.headersSent) res.status(500).send('Internal error');
		}
	}
);
