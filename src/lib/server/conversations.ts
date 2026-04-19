import { adminDb } from './admin.js';
import { FieldValue } from 'firebase-admin/firestore';
import {
	decryptProviderKey,
	runAssistantChat,
	type AssistantDoc,
	type ChatMessage,
	type ConversationDoc,
	type EncryptedProviderKey,
	type PersistedMessage
} from '@prompt-to-api/shared';

/**
 * Mirrors the conversation logic in `functions/src/api.ts`. Both call the same
 * `runAssistantChat` from the shared package so the dashboard-side chat and
 * public /v1 API produce identical behaviour.
 */

function convRef(ownerUid: string, assistantId: string, conversationId: string) {
	return adminDb
		.collection('users')
		.doc(ownerUid)
		.collection('assistants')
		.doc(assistantId)
		.collection('conversations')
		.doc(conversationId);
}

export async function createConversation(args: {
	ownerUid: string;
	assistantId: string;
	title?: string;
	source: 'dashboard' | 'api';
}): Promise<ConversationDoc> {
	const ref = adminDb
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
	console.log('[conversations] created', {
		uid: args.ownerUid,
		assistantId: args.assistantId,
		conversationId: ref.id,
		source: args.source
	});
	return doc;
}

export async function getConversation(
	ownerUid: string,
	assistantId: string,
	conversationId: string
): Promise<(ConversationDoc & { messages: PersistedMessage[] }) | null> {
	const ref = convRef(ownerUid, assistantId, conversationId);
	const snap = await ref.get();
	if (!snap.exists) return null;
	const messagesSnap = await ref.collection('messages').orderBy('createdAt').get();
	return {
		...(snap.data() as ConversationDoc),
		messages: messagesSnap.docs.map((d) => d.data() as PersistedMessage)
	};
}

export async function deleteConversation(
	ownerUid: string,
	assistantId: string,
	conversationId: string
): Promise<boolean> {
	const ref = convRef(ownerUid, assistantId, conversationId);
	const snap = await ref.get();
	if (!snap.exists) return false;
	const msgs = await ref.collection('messages').get();
	const batch = adminDb.batch();
	msgs.forEach((m) => batch.delete(m.ref));
	batch.delete(ref);
	await batch.commit();
	return true;
}

export async function listConversations(
	ownerUid: string,
	assistantId: string
): Promise<ConversationDoc[]> {
	const snap = await adminDb
		.collection('users')
		.doc(ownerUid)
		.collection('assistants')
		.doc(assistantId)
		.collection('conversations')
		.orderBy('updatedAt', 'desc')
		.limit(50)
		.get();
	return snap.docs.map((d) => d.data() as ConversationDoc);
}

export async function appendAndGenerate(args: {
	ownerUid: string;
	assistant: AssistantDoc;
	conversationId: string;
	newMessages: ChatMessage[];
	source: 'dashboard' | 'api';
}): Promise<
	| {
			conversationId: string;
			message: ChatMessage;
			usage: { tokensIn: number | null; tokensOut: number | null };
	  }
	| { error: 'provider_key_not_configured' | 'conversation_not_found' }
> {
	const { ownerUid, assistant, conversationId, newMessages } = args;

	const keySnap = await adminDb
		.collection('users')
		.doc(ownerUid)
		.collection('providerKeys')
		.doc(assistant.provider)
		.get();
	if (!keySnap.exists) return { error: 'provider_key_not_configured' };
	const providerKey = decryptProviderKey(keySnap.data() as EncryptedProviderKey);

	const ref = convRef(ownerUid, assistant.id, conversationId);
	const convSnap = await ref.get();
	if (!convSnap.exists) return { error: 'conversation_not_found' };

	const priorSnap = await ref.collection('messages').orderBy('createdAt').get();
	const prior = priorSnap.docs.map((d) => {
		const data = d.data() as PersistedMessage;
		return { role: data.role, content: data.content } as ChatMessage;
	});

	const fullHistory: ChatMessage[] = [...prior, ...newMessages];

	const response = await runAssistantChat({
		assistant,
		providerApiKey: providerKey,
		messages: fullHistory
	});

	const now = Date.now();
	const batch = adminDb.batch();
	let order = now;
	for (const m of newMessages) {
		const msgRef = ref.collection('messages').doc();
		batch.set(msgRef, { id: msgRef.id, role: m.role, content: m.content, createdAt: order++ });
	}
	const replyRef = ref.collection('messages').doc();
	batch.set(replyRef, {
		id: replyRef.id,
		role: 'assistant',
		content: response.content,
		tokensIn: response.tokensIn ?? null,
		tokensOut: response.tokensOut ?? null,
		createdAt: order++
	});
	batch.update(ref, {
		updatedAt: now,
		messageCount: FieldValue.increment(newMessages.length + 1)
	});
	batch.update(
		adminDb.collection('users').doc(ownerUid).collection('assistants').doc(assistant.id),
		{ updatedAt: now }
	);
	await batch.commit();

	return {
		conversationId,
		message: { role: 'assistant', content: response.content },
		usage: { tokensIn: response.tokensIn ?? null, tokensOut: response.tokensOut ?? null }
	};
}
