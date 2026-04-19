import type { Request, Response } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './admin.js';
import {
	buildOpenApiSpec,
	hashApiToken,
	decryptProviderKey,
	runAssistantChat,
	type AssistantDoc,
	type EncryptedProviderKey,
	type ApiTokenDoc,
	type ChatMessage,
	type ConversationDoc,
	type PersistedMessage
} from '@prompt-to-api/shared';

/**
 * Normalise the incoming path. The function is invoked at:
 *   - /v1/assistants/:id/chat           (hosting rewrite or direct emulator URL)
 *   - /v1/assistants/:id/openapi.json
 *   - /v1/assistants/:id/docs
 *   - /v1/assistants/:id/conversations
 *   - /v1/assistants/:id/conversations/:convId
 *   - /v1/assistants/:id/conversations/:convId/messages
 *
 * When invoked via the emulator the path may be missing the /v1 prefix.
 */
function normalisePath(rawPath: string): string {
	const p = rawPath.split('?')[0].replace(/\/+$/, '') || '/';
	if (p.startsWith('/v1/')) return p.slice(3); // strip /v1
	if (p === '/v1') return '/';
	return p;
}

export async function handleApiRequest(req: Request, res: Response): Promise<void> {
	const path = normalisePath(req.path);
	console.log('[api] request', { method: req.method, path, rawPath: req.path });

	if (path === '/' || path === '/health') {
		res.status(200).json({ ok: true, service: 'prompt-to-api', ts: Date.now() });
		return;
	}

	// /assistants/:id/chat (convenience shortcut)
	const chatMatch = /^\/assistants\/([^/]+)\/chat$/.exec(path);
	if (chatMatch) {
		await handleChatShortcut(req, res, chatMatch[1]);
		return;
	}

	// /assistants/:id/conversations
	const convCreateMatch = /^\/assistants\/([^/]+)\/conversations$/.exec(path);
	if (convCreateMatch) {
		await handleCreateConversation(req, res, convCreateMatch[1]);
		return;
	}

	// /assistants/:id/conversations/:convId/messages
	const appendMatch = /^\/assistants\/([^/]+)\/conversations\/([^/]+)\/messages$/.exec(path);
	if (appendMatch) {
		await handleAppendMessages(req, res, appendMatch[1], appendMatch[2]);
		return;
	}

	// /assistants/:id/conversations/:convId
	const convMatch = /^\/assistants\/([^/]+)\/conversations\/([^/]+)$/.exec(path);
	if (convMatch) {
		if (req.method === 'GET') {
			await handleGetConversation(req, res, convMatch[1], convMatch[2]);
			return;
		}
		if (req.method === 'DELETE') {
			await handleDeleteConversation(req, res, convMatch[1], convMatch[2]);
			return;
		}
		res.status(405).json({ error: 'method_not_allowed' });
		return;
	}

	const openapiMatch = /^\/assistants\/([^/]+)\/openapi\.json$/.exec(path);
	if (openapiMatch) {
		await handleOpenApi(req, res, openapiMatch[1]);
		return;
	}

	const docsMatch = /^\/assistants\/([^/]+)\/docs$/.exec(path);
	if (docsMatch) {
		await handleDocs(req, res, docsMatch[1]);
		return;
	}

	res.status(404).json({ error: 'not_found', path });
}

// --- Auth helpers ------------------------------------------------------------

interface AuthCtx {
	token: ApiTokenDoc;
	assistant: AssistantDoc;
	providerKey: string;
}

async function authenticate(
	req: Request,
	assistantId: string
): Promise<{ ctx: AuthCtx } | { err: { status: number; body: Record<string, string> } }> {
	const authHeader = req.header('authorization') ?? '';
	const m = /^Bearer\s+(\S+)$/i.exec(authHeader);
	if (!m) return { err: { status: 401, body: { error: 'missing_bearer_token' } } };
	const plaintext = m[1];
	const tokenHash = hashApiToken(plaintext);

	const tokenSnap = await db.collection('apiTokens').doc(tokenHash).get();
	if (!tokenSnap.exists) return { err: { status: 401, body: { error: 'invalid_token' } } };
	const token = tokenSnap.data() as ApiTokenDoc;
	if (token.revokedAt) return { err: { status: 401, body: { error: 'token_revoked' } } };
	if (token.assistantId !== assistantId) {
		return { err: { status: 403, body: { error: 'token_assistant_mismatch' } } };
	}

	const assistantSnap = await db
		.collection('users')
		.doc(token.ownerUid)
		.collection('assistants')
		.doc(assistantId)
		.get();
	if (!assistantSnap.exists) {
		return { err: { status: 404, body: { error: 'assistant_not_found' } } };
	}
	const assistant = { id: assistantSnap.id, ...assistantSnap.data() } as AssistantDoc;

	const keySnap = await db
		.collection('users')
		.doc(token.ownerUid)
		.collection('providerKeys')
		.doc(assistant.provider)
		.get();
	if (!keySnap.exists) {
		return { err: { status: 412, body: { error: 'provider_key_not_configured' } } };
	}
	let providerKey: string;
	try {
		providerKey = decryptProviderKey(keySnap.data() as EncryptedProviderKey);
	} catch (err) {
		console.error('[api] decrypt failed', err);
		return { err: { status: 500, body: { error: 'decrypt_failed' } } };
	}

	tokenSnap.ref
		.update({ lastUsedAt: Date.now() })
		.catch((e) => console.warn('[api] lastUsedAt', e));

	return { ctx: { token, assistant, providerKey } };
}

// --- Conversation handlers ---------------------------------------------------

async function handleCreateConversation(
	req: Request,
	res: Response,
	assistantId: string
): Promise<void> {
	if (req.method !== 'POST') {
		res.status(405).json({ error: 'method_not_allowed' });
		return;
	}
	const auth = await authenticate(req, assistantId);
	if ('err' in auth) {
		res.status(auth.err.status).json(auth.err.body);
		return;
	}
	const body = (req.body ?? {}) as { title?: string };
	const conversation = await createConversation({
		ownerUid: auth.ctx.token.ownerUid,
		assistantId,
		title: body.title,
		source: 'api'
	});
	res.status(201).json(conversation);
}

async function handleGetConversation(
	req: Request,
	res: Response,
	assistantId: string,
	conversationId: string
): Promise<void> {
	const auth = await authenticate(req, assistantId);
	if ('err' in auth) {
		res.status(auth.err.status).json(auth.err.body);
		return;
	}
	const { ownerUid } = auth.ctx.token;
	const convRef = conversationRef(ownerUid, assistantId, conversationId);
	const convSnap = await convRef.get();
	if (!convSnap.exists) {
		res.status(404).json({ error: 'conversation_not_found' });
		return;
	}
	const messagesSnap = await convRef.collection('messages').orderBy('createdAt').get();
	const messages = messagesSnap.docs.map((d) => d.data() as PersistedMessage);
	res.status(200).json({ ...(convSnap.data() as ConversationDoc), messages });
}

async function handleDeleteConversation(
	req: Request,
	res: Response,
	assistantId: string,
	conversationId: string
): Promise<void> {
	const auth = await authenticate(req, assistantId);
	if ('err' in auth) {
		res.status(auth.err.status).json(auth.err.body);
		return;
	}
	const { ownerUid } = auth.ctx.token;
	const convRef = conversationRef(ownerUid, assistantId, conversationId);
	const convSnap = await convRef.get();
	if (!convSnap.exists) {
		res.status(404).json({ error: 'conversation_not_found' });
		return;
	}
	const msgs = await convRef.collection('messages').get();
	const batch = db.batch();
	msgs.forEach((m) => batch.delete(m.ref));
	batch.delete(convRef);
	await batch.commit();
	res.status(204).send('');
}

async function handleAppendMessages(
	req: Request,
	res: Response,
	assistantId: string,
	conversationId: string
): Promise<void> {
	if (req.method !== 'POST') {
		res.status(405).json({ error: 'method_not_allowed' });
		return;
	}
	const auth = await authenticate(req, assistantId);
	if ('err' in auth) {
		res.status(auth.err.status).json(auth.err.body);
		return;
	}
	const body = (req.body ?? {}) as { messages?: ChatMessage[] };
	const newMessages = (body.messages ?? []).filter((m) => m && typeof m.content === 'string');
	if (newMessages.length === 0) {
		res.status(400).json({ error: 'messages_required' });
		return;
	}

	const { ownerUid, assistant, providerKey } = { ...auth.ctx, ownerUid: auth.ctx.token.ownerUid };
	const reply = await appendAndGenerate({
		ownerUid,
		assistant,
		providerKey,
		conversationId,
		newMessages,
		source: 'api'
	});
	if (!reply) {
		res.status(404).json({ error: 'conversation_not_found' });
		return;
	}
	res.status(200).json(reply);
}

async function handleChatShortcut(req: Request, res: Response, assistantId: string): Promise<void> {
	if (req.method !== 'POST') {
		res.status(405).json({ error: 'method_not_allowed' });
		return;
	}
	const auth = await authenticate(req, assistantId);
	if ('err' in auth) {
		res.status(auth.err.status).json(auth.err.body);
		return;
	}
	const body = (req.body ?? {}) as { messages?: ChatMessage[]; conversationId?: string };
	const newMessages = (body.messages ?? []).filter((m) => m && typeof m.content === 'string');
	if (newMessages.length === 0) {
		res.status(400).json({ error: 'messages_required' });
		return;
	}
	const ownerUid = auth.ctx.token.ownerUid;

	let conversationId = body.conversationId;
	if (!conversationId) {
		const conv = await createConversation({
			ownerUid,
			assistantId,
			title: newMessages[0].content.slice(0, 60),
			source: 'api'
		});
		conversationId = conv.id;
	}

	const reply = await appendAndGenerate({
		ownerUid,
		assistant: auth.ctx.assistant,
		providerKey: auth.ctx.providerKey,
		conversationId,
		newMessages,
		source: 'api'
	});
	if (!reply) {
		res.status(404).json({ error: 'conversation_not_found' });
		return;
	}
	res.status(200).json(reply);
}

// --- Shared Firestore helpers ------------------------------------------------

function conversationRef(ownerUid: string, assistantId: string, conversationId: string) {
	return db
		.collection('users')
		.doc(ownerUid)
		.collection('assistants')
		.doc(assistantId)
		.collection('conversations')
		.doc(conversationId);
}

async function createConversation(args: {
	ownerUid: string;
	assistantId: string;
	title?: string;
	source: 'dashboard' | 'api';
}): Promise<ConversationDoc> {
	const ref = db
		.collection('users')
		.doc(args.ownerUid)
		.collection('assistants')
		.doc(args.assistantId)
		.collection('conversations')
		.doc();
	const now = Date.now();
	const doc: ConversationDoc = {
		id: ref.id,
		title: args.title?.slice(0, 120) || 'New conversation',
		createdAt: now,
		updatedAt: now,
		messageCount: 0,
		source: args.source
	};
	await ref.set(doc);
	console.log('[api] conversation created', {
		uid: args.ownerUid,
		assistantId: args.assistantId,
		conversationId: ref.id,
		source: args.source
	});
	return doc;
}

async function appendAndGenerate(args: {
	ownerUid: string;
	assistant: AssistantDoc;
	providerKey: string;
	conversationId: string;
	newMessages: ChatMessage[];
	source: 'dashboard' | 'api';
}): Promise<{ conversationId: string; message: ChatMessage; usage: { tokensIn: number | null; tokensOut: number | null } } | null> {
	const convRef = conversationRef(args.ownerUid, args.assistant.id, args.conversationId);
	const convSnap = await convRef.get();
	if (!convSnap.exists) return null;

	// Load prior transcript, ordered.
	const priorSnap = await convRef.collection('messages').orderBy('createdAt').get();
	const prior = priorSnap.docs.map((d) => {
		const data = d.data() as PersistedMessage;
		return { role: data.role, content: data.content } as ChatMessage;
	});

	const fullHistory: ChatMessage[] = [...prior, ...args.newMessages];

	const response = await runAssistantChat({
		assistant: args.assistant,
		providerApiKey: args.providerKey,
		messages: fullHistory
	});

	const now = Date.now();
	const batch = db.batch();
	let order = now;
	for (const m of args.newMessages) {
		const msgRef = convRef.collection('messages').doc();
		batch.set(msgRef, { id: msgRef.id, role: m.role, content: m.content, createdAt: order++ });
	}
	const replyRef = convRef.collection('messages').doc();
	batch.set(replyRef, {
		id: replyRef.id,
		role: 'assistant',
		content: response.content,
		tokensIn: response.tokensIn ?? null,
		tokensOut: response.tokensOut ?? null,
		createdAt: order++
	});
	batch.update(convRef, {
		updatedAt: now,
		messageCount: FieldValue.increment(args.newMessages.length + 1)
	});
	batch.update(
		db.collection('users').doc(args.ownerUid).collection('assistants').doc(args.assistant.id),
		{ updatedAt: now }
	);
	await batch.commit();

	return {
		conversationId: args.conversationId,
		message: { role: 'assistant', content: response.content },
		usage: { tokensIn: response.tokensIn ?? null, tokensOut: response.tokensOut ?? null }
	};
}

// --- OpenAPI / Swagger -------------------------------------------------------

async function fetchAssistantPublic(assistantId: string): Promise<AssistantDoc | null> {
	const group = await db
		.collectionGroup('assistants')
		.where('id', '==', assistantId)
		.limit(1)
		.get();
	if (group.empty) return null;
	const snap = group.docs[0];
	return { id: snap.id, ...snap.data() } as AssistantDoc;
}

function hostedBaseUrl(req: Request): string {
	const proto = (req.header('x-forwarded-proto') ?? 'https').split(',')[0];
	const host = req.header('x-forwarded-host') ?? req.header('host') ?? 'localhost';
	return `${proto}://${host}/v1`;
}

async function handleOpenApi(req: Request, res: Response, assistantId: string): Promise<void> {
	// The OpenAPI spec is always public. It exposes only paths + schemas — no
	// secrets — and /docs (Swagger UI) is already public, so gating the spec
	// would just break the UI without adding security. The actual data
	// endpoints remain bearer-token protected.
	const assistant = await fetchAssistantPublic(assistantId);
	if (!assistant) {
		res.status(404).json({ error: 'assistant_not_found' });
		return;
	}
	const spec = buildOpenApiSpec({ assistant, baseUrl: hostedBaseUrl(req) });
	res.status(200).json(spec);
}

async function handleDocs(req: Request, res: Response, assistantId: string): Promise<void> {
	const openapiUrl = `${hostedBaseUrl(req)}/assistants/${assistantId}/openapi.json`;
	res.setHeader('content-type', 'text/html; charset=utf-8');
	res.status(200).send(`<!DOCTYPE html>
<html lang="en" style="color-scheme: dark">
<head>
  <meta charset="utf-8" />
  <title>Prompt To API — Docs</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    /*
     * Dark theme for Swagger UI, tuned to match the Prompt To API dashboard.
     * Swagger UI doesn't ship an official dark theme, so we override the key
     * surface / text / border / accent colors. Scoped to .swagger-ui so we
     * don't touch anything else on the page.
     */
    :root {
      --pta-bg: #07070a;
      --pta-panel: #0f1015;
      --pta-panel-2: #14151c;
      --pta-border: #24262f;
      --pta-text: #e4e6eb;
      --pta-text-dim: #9aa0a6;
      --pta-accent: #8b5cf6;
      --pta-get: #3b82f6;
      --pta-post: #10b981;
      --pta-delete: #ef4444;
      --pta-patch: #f59e0b;
    }
    html, body { background: var(--pta-bg); margin: 0; color: var(--pta-text); }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif; }

    /* Top bar — Swagger's default green — we hide it for a cleaner look. */
    .swagger-ui .topbar { display: none; }

    /* Overall surface */
    .swagger-ui, .swagger-ui .wrapper { background: var(--pta-bg); color: var(--pta-text); }
    .swagger-ui .info,
    .swagger-ui .info .title,
    .swagger-ui .info p,
    .swagger-ui .info li,
    .swagger-ui .info a,
    .swagger-ui .info table,
    .swagger-ui .scheme-container,
    .swagger-ui .opblock-tag,
    .swagger-ui .opblock-tag small,
    .swagger-ui .opblock .opblock-summary-path,
    .swagger-ui .opblock .opblock-summary-description,
    .swagger-ui .opblock-description-wrapper p,
    .swagger-ui .opblock-external-docs-wrapper p,
    .swagger-ui .opblock-title_normal p,
    .swagger-ui .responses-inner h4,
    .swagger-ui .responses-inner h5,
    .swagger-ui table thead tr td,
    .swagger-ui table thead tr th,
    .swagger-ui .parameter__name,
    .swagger-ui .parameter__type,
    .swagger-ui .parameter__in,
    .swagger-ui .parameter__deprecated,
    .swagger-ui .response-col_status,
    .swagger-ui .response-col_description,
    .swagger-ui .tab li,
    .swagger-ui .tab li button.tablinks,
    .swagger-ui label,
    .swagger-ui .model-title,
    .swagger-ui .model,
    .swagger-ui section.models h4,
    .swagger-ui section.models h4 span,
    .swagger-ui section.models .model-container,
    .swagger-ui .btn,
    .swagger-ui .dialog-ux .modal-ux,
    .swagger-ui .dialog-ux .modal-ux-header h3,
    .swagger-ui .dialog-ux .modal-ux-content,
    .swagger-ui .auth-container h4 { color: var(--pta-text); }

    /* Muted / secondary text */
    .swagger-ui .opblock-tag small,
    .swagger-ui .info small,
    .swagger-ui .info .base-url,
    .swagger-ui .parameter__in,
    .swagger-ui .response-col_links .response-undocumented,
    .swagger-ui .model .property.primitive,
    .swagger-ui .prop-type,
    .swagger-ui .prop-format,
    .swagger-ui .markdown code,
    .swagger-ui .renderedMarkdown code { color: var(--pta-text-dim); }

    /* Links */
    .swagger-ui a { color: #c4b5fd; }
    .swagger-ui a:hover { color: #a78bfa; }

    /* Scheme / servers bar + auth container */
    .swagger-ui .scheme-container,
    .swagger-ui .auth-wrapper,
    .swagger-ui .auth-container {
      background: var(--pta-panel);
      border: 1px solid var(--pta-border);
      box-shadow: none;
    }

    /* Operation blocks (panels per endpoint) */
    .swagger-ui .opblock {
      background: var(--pta-panel);
      border: 1px solid var(--pta-border);
      box-shadow: none;
      border-radius: 6px;
      margin-bottom: 12px;
    }
    .swagger-ui .opblock .opblock-summary { border-bottom: 1px solid var(--pta-border); }
    .swagger-ui .opblock .opblock-summary-path,
    .swagger-ui .opblock .opblock-summary-path__deprecated { color: var(--pta-text); }
    .swagger-ui .opblock .opblock-section-header {
      background: var(--pta-panel-2);
      border-bottom: 1px solid var(--pta-border);
      box-shadow: none;
    }
    .swagger-ui .opblock .opblock-section-header h4,
    .swagger-ui .opblock .opblock-section-header > label { color: var(--pta-text); }

    /* Method pills keep their Swagger colors for quick scanning, just with
       slightly adjusted tints for legibility on dark. */
    .swagger-ui .opblock.opblock-get { background: rgba(59, 130, 246, .06); border-color: rgba(59, 130, 246, .4); }
    .swagger-ui .opblock.opblock-get .opblock-summary-method { background: var(--pta-get); }
    .swagger-ui .opblock.opblock-post { background: rgba(16, 185, 129, .06); border-color: rgba(16, 185, 129, .4); }
    .swagger-ui .opblock.opblock-post .opblock-summary-method { background: var(--pta-post); }
    .swagger-ui .opblock.opblock-delete { background: rgba(239, 68, 68, .06); border-color: rgba(239, 68, 68, .4); }
    .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: var(--pta-delete); }
    .swagger-ui .opblock.opblock-patch { background: rgba(245, 158, 11, .06); border-color: rgba(245, 158, 11, .4); }
    .swagger-ui .opblock.opblock-patch .opblock-summary-method { background: var(--pta-patch); }

    /* Tables */
    .swagger-ui table { background: transparent; }
    .swagger-ui table thead tr td,
    .swagger-ui table thead tr th { border-bottom: 1px solid var(--pta-border); color: var(--pta-text-dim); }
    .swagger-ui table tbody tr td { border-color: var(--pta-border); color: var(--pta-text); }
    .swagger-ui .parameters-col_description { color: var(--pta-text); }

    /* Inputs, selects, textareas */
    .swagger-ui input[type=text],
    .swagger-ui input[type=password],
    .swagger-ui input[type=email],
    .swagger-ui input[type=search],
    .swagger-ui input[type=file],
    .swagger-ui textarea,
    .swagger-ui select {
      background: #0a0b10;
      color: var(--pta-text);
      border: 1px solid var(--pta-border);
      border-radius: 4px;
    }
    .swagger-ui input[type=text]:focus,
    .swagger-ui textarea:focus,
    .swagger-ui select:focus {
      border-color: var(--pta-accent);
      outline: none;
    }

    /* Code blocks / highlight.js output */
    .swagger-ui .highlight-code,
    .swagger-ui .microlight,
    .swagger-ui .body-param__example,
    .swagger-ui .example,
    .swagger-ui pre,
    .swagger-ui .response-col_description__inner div.markdown,
    .swagger-ui .response-col_description__inner div.renderedMarkdown {
      background: #0a0b10 !important;
      color: #e4e6eb !important;
      border: 1px solid var(--pta-border);
      border-radius: 4px;
    }
    .swagger-ui .microlight { padding: 10px; }
    .swagger-ui .copy-to-clipboard { background: #1a1b22; color: var(--pta-text); }

    /* Models / schemas */
    .swagger-ui section.models {
      background: var(--pta-panel);
      border: 1px solid var(--pta-border);
      border-radius: 6px;
    }
    .swagger-ui section.models.is-open h4 { border-bottom: 1px solid var(--pta-border); }
    .swagger-ui section.models .model-container { background: var(--pta-panel-2); border-color: var(--pta-border); }
    .swagger-ui .model-toggle:after { filter: invert(1) brightness(1.2); }
    .swagger-ui .model .property { color: var(--pta-text); }
    .swagger-ui .model .property.primitive { color: var(--pta-text-dim); }

    /* Buttons */
    .swagger-ui .btn {
      background: var(--pta-panel-2);
      color: var(--pta-text);
      border: 1px solid var(--pta-border);
    }
    .swagger-ui .btn:hover { background: #1f2029; }
    .swagger-ui .btn.authorize { color: #c4b5fd; border-color: var(--pta-accent); }
    .swagger-ui .btn.authorize svg { fill: #c4b5fd; }
    .swagger-ui .btn.execute { background: var(--pta-accent); color: white; border-color: var(--pta-accent); }
    .swagger-ui .btn.execute:hover { background: #7c3aed; }
    .swagger-ui .btn.cancel { color: #f87171; border-color: #7f1d1d; }

    /* Expand / collapse arrows */
    .swagger-ui .expand-methods svg,
    .swagger-ui .opblock-summary-control svg,
    .swagger-ui .opblock-control-arrow,
    .swagger-ui section.models h4 svg,
    .swagger-ui .arrow { fill: var(--pta-text); }

    /* Dialogs / modals (authorize) */
    .swagger-ui .dialog-ux .backdrop-ux { background: rgba(0,0,0,.75); }
    .swagger-ui .dialog-ux .modal-ux { background: var(--pta-panel); border: 1px solid var(--pta-border); }
    .swagger-ui .dialog-ux .modal-ux-header { background: var(--pta-panel-2); border-bottom: 1px solid var(--pta-border); }
    .swagger-ui .dialog-ux .modal-ux-content { color: var(--pta-text); }

    /* Response section */
    .swagger-ui .responses-inner { background: transparent; }
    .swagger-ui .response { border-bottom: 1px solid var(--pta-border); }
    .swagger-ui .response-col_status { color: var(--pta-text); }
    .swagger-ui .response-col_description__inner p { color: var(--pta-text-dim); }

    /* Tabs (Example / Schema) */
    .swagger-ui .tab li.active button.tablinks,
    .swagger-ui .tab li.tabitem.active h4.opblock-title_normal,
    .swagger-ui .tab li.tabitem.active { color: var(--pta-accent); }

    /* Info header title */
    .swagger-ui .info hgroup.main a { color: var(--pta-text-dim); }
    .swagger-ui .info .title small pre { background: var(--pta-panel-2); color: var(--pta-text); padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: ${JSON.stringify(openapiUrl)},
        dom_id: '#swagger-ui',
        presets: [SwaggerUIBundle.presets.apis],
        layout: 'BaseLayout',
        persistAuthorization: true,
        docExpansion: 'list',
        defaultModelsExpandDepth: 0
      });
    };
  </script>
</body>
</html>`);
}
