import type {
	AssistantDoc,
	ChatMessage,
	ChatProvider,
	ProviderChatRequest,
	ProviderChatResponse
} from './types.js';
import { anthropicProvider } from './providers/anthropic.js';
import { openaiProvider } from './providers/openai.js';
import { geminiProvider } from './providers/gemini.js';

const PROVIDERS: Record<string, ChatProvider> = {
	anthropic: anthropicProvider,
	openai: openaiProvider,
	gemini: geminiProvider
};

/**
 * Single entry point used by both the dashboard's in-browser chat and the
 * public /v1 API. Guarantees identical behaviour for "chat in UI" vs "chat via
 * external tool".
 */
export async function runAssistantChat(args: {
	assistant: AssistantDoc;
	providerApiKey: string;
	messages: ChatMessage[];
}): Promise<ProviderChatResponse> {
	const { assistant, providerApiKey, messages } = args;
	const provider = PROVIDERS[assistant.provider];
	if (!provider) {
		throw new Error(`Unknown provider: ${assistant.provider}`);
	}

	const req: ProviderChatRequest = {
		model: assistant.model,
		systemPrompt: assistant.systemPrompt,
		messages,
		temperature: assistant.temperature,
		maxTokens: assistant.maxTokens,
		apiKey: providerApiKey
	};

	console.log('[chat-core]', {
		provider: assistant.provider,
		model: assistant.model,
		assistantId: assistant.id,
		msgCount: messages.length
	});

	const started = Date.now();
	try {
		const response = await provider.chat(req);
		console.log('[chat-core] ok', {
			provider: assistant.provider,
			ms: Date.now() - started,
			tokensIn: response.tokensIn,
			tokensOut: response.tokensOut,
			chars: response.content.length
		});
		return response;
	} catch (err) {
		console.error('[chat-core] fail', {
			provider: assistant.provider,
			ms: Date.now() - started,
			err: err instanceof Error ? err.message : String(err)
		});
		throw err;
	}
}
