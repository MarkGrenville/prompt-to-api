// Shared types used by both SvelteKit frontend and Cloud Functions.
// Keep this file in sync with docs/models.md.

export type ProviderId = 'anthropic' | 'openai' | 'gemini';

export interface UserProfile {
	uid: string;
	email: string | null;
	displayName: string | null;
	createdAt: number; // ms since epoch
}

export interface EncryptedProviderKey {
	provider: ProviderId;
	/** base64-encoded AES-256-GCM ciphertext */
	ciphertext: string;
	/** base64-encoded 12-byte IV */
	iv: string;
	/** base64-encoded 16-byte auth tag */
	authTag: string;
	updatedAt: number;
}

export interface AssistantDoc {
	id: string;
	name: string;
	/** URL-safe slug, unique within a user's assistants. */
	slug: string;
	systemPrompt: string;
	provider: ProviderId;
	model: string;
	temperature: number;
	maxTokens: number;
	/** If true, the OpenAPI spec can be fetched without auth (useful for giving Cursor the URL). */
	publicSpec: boolean;
	createdAt: number;
	updatedAt: number;
}

export interface ApiTokenDoc {
	/** hex sha256 of the token string */
	tokenHash: string;
	ownerUid: string;
	assistantId: string;
	label: string;
	/** Last 4 chars of the plaintext token, for display in the UI. */
	lastFour: string;
	createdAt: number;
	lastUsedAt: number | null;
	revokedAt: number | null;
}

export interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export interface PersistedMessage extends ChatMessage {
	id: string;
	tokensIn?: number;
	tokensOut?: number;
	createdAt: number;
}

export interface ConversationDoc {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
	/** How many message documents are persisted under this conversation. */
	messageCount: number;
	/** Where the conversation was started from. */
	source: 'dashboard' | 'api';
}

/** @deprecated use {@link ConversationDoc} — retained for one release */
export type ChatDoc = ConversationDoc;

// Provider adapter interface --------------------------------------------------

export interface ProviderChatRequest {
	model: string;
	systemPrompt: string;
	messages: ChatMessage[];
	temperature: number;
	maxTokens: number;
	apiKey: string;
}

export interface ProviderChatResponse {
	content: string;
	tokensIn?: number;
	tokensOut?: number;
	raw?: unknown;
}

export interface ChatProvider {
	id: ProviderId;
	chat(req: ProviderChatRequest): Promise<ProviderChatResponse>;
}

// Default model fallbacks (see docs/models.md).
export const DEFAULT_MODELS: Record<ProviderId, string> = {
	anthropic: 'claude-sonnet-4-5-20250929',
	openai: 'gpt-4o-mini',
	gemini: 'gemini-2.5-flash'
};

/**
 * Suggested models per provider. These are offered in the "create assistant"
 * UI as a dropdown but the user can always type any other model name — we
 * never hard-reject unknown values since providers add/rename models often.
 */
export interface ModelChoice {
	id: string;
	label: string;
	hint?: string;
}

export const MODELS_BY_PROVIDER: Record<ProviderId, ModelChoice[]> = {
	anthropic: [
		{ id: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5', hint: 'Default · balanced' },
		{ id: 'claude-opus-4-20250514', label: 'Claude Opus 4', hint: 'Highest quality' },
		{ id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', hint: 'Fastest, cheapest' }
	],
	openai: [
		{ id: 'gpt-4o-mini', label: 'GPT-4o mini', hint: 'Default · cheap + fast' },
		{ id: 'gpt-4o', label: 'GPT-4o', hint: 'Flagship' },
		{ id: 'o4-mini', label: 'o4-mini', hint: 'Reasoning, cheaper' },
		{ id: 'o3', label: 'o3', hint: 'Reasoning, flagship' }
	],
	gemini: [
		{ id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', hint: 'Default · fast' },
		{ id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', hint: 'Highest quality' },
		{ id: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash (exp)', hint: 'Experimental' }
	]
};
