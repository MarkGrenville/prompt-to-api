import type { ChatProvider, ProviderChatRequest, ProviderChatResponse } from '../types.js';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const VERSION = '2023-06-01';

export const anthropicProvider: ChatProvider = {
	id: 'anthropic',
	async chat(req: ProviderChatRequest): Promise<ProviderChatResponse> {
		const body = {
			model: req.model,
			max_tokens: req.maxTokens,
			temperature: req.temperature,
			system: req.systemPrompt,
			messages: req.messages
				.filter((m) => m.role !== 'system')
				.map((m) => ({ role: m.role, content: m.content }))
		};

		const res = await fetch(ENDPOINT, {
			method: 'POST',
			headers: {
				'x-api-key': req.apiKey,
				'anthropic-version': VERSION,
				'content-type': 'application/json'
			},
			body: JSON.stringify(body)
		});

		if (!res.ok) {
			const text = await res.text();
			throw new Error(`anthropic ${res.status}: ${text.slice(0, 500)}`);
		}
		const json = (await res.json()) as {
			content: Array<{ type: string; text?: string }>;
			usage?: { input_tokens?: number; output_tokens?: number };
		};
		const content = json.content
			.filter((c) => c.type === 'text' && typeof c.text === 'string')
			.map((c) => c.text as string)
			.join('\n');
		return {
			content,
			tokensIn: json.usage?.input_tokens,
			tokensOut: json.usage?.output_tokens,
			raw: json
		};
	}
};
