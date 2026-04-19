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
	anthropic: 'claude-sonnet-4-6',
	openai: 'gpt-5.4',
	gemini: 'gemini-3-flash-preview'
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
		{
			id: 'claude-sonnet-4-6',
			label: 'Claude Sonnet 4.6',
			hint: 'Default · balanced quality and speed'
		},
		{
			id: 'claude-opus-4-7',
			label: 'Claude Opus 4.7',
			hint: 'Flagship · highest quality, slower, premium price'
		},
		{
			id: 'claude-haiku-4-5-20251001',
			label: 'Claude Haiku 4.5',
			hint: 'Cheapest + fastest · for high-volume simple tasks'
		},
		{
			id: 'claude-sonnet-4-5-20250929',
			label: 'Claude Sonnet 4.5',
			hint: 'Previous gen · pin if behavior must stay stable'
		}
	],
	openai: [
		{
			id: 'gpt-5.4',
			label: 'GPT-5.4',
			hint: 'Default · flagship balance of reasoning, speed, price'
		},
		{
			id: 'gpt-5.4-pro',
			label: 'GPT-5.4 Pro',
			hint: 'Heaviest reasoning · premium for deep agentic work'
		},
		{
			id: 'gpt-5.4-nano',
			label: 'GPT-5.4 nano',
			hint: 'Cheapest · for huge volume or trivial tasks'
		},
		{
			id: 'o4-mini',
			label: 'o4-mini',
			hint: 'Reasoning specialist · cheap, strong at code and math'
		}
	],
	gemini: [
		{
			id: 'gemini-3-flash-preview',
			label: 'Gemini 3 Flash (preview)',
			hint: 'Default · newest balanced model, very cheap'
		},
		{
			id: 'gemini-3.1-pro-preview',
			label: 'Gemini 3.1 Pro (preview)',
			hint: 'Flagship · top reasoning, longer thinking'
		},
		{
			id: 'gemini-3.1-flash-lite-preview',
			label: 'Gemini 3.1 Flash-Lite (preview)',
			hint: 'Cheapest · simple tasks at huge volume'
		},
		{
			id: 'gemini-2.5-pro',
			label: 'Gemini 2.5 Pro',
			hint: 'Stable · non-preview if you want predictable behavior'
		}
	]
};
