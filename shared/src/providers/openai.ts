import type { ChatProvider, ProviderChatRequest, ProviderChatResponse } from '../types.js';

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

export const openaiProvider: ChatProvider = {
	id: 'openai',
	async chat(req: ProviderChatRequest): Promise<ProviderChatResponse> {
		const messages = [
			{ role: 'system', content: req.systemPrompt },
			...req.messages.filter((m) => m.role !== 'system')
		];

		const body = {
			model: req.model,
			temperature: req.temperature,
			max_tokens: req.maxTokens,
			messages
		};

		const res = await fetch(ENDPOINT, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${req.apiKey}`,
				'content-type': 'application/json'
			},
			body: JSON.stringify(body)
		});

		if (!res.ok) {
			const text = await res.text();
			throw new Error(`openai ${res.status}: ${text.slice(0, 500)}`);
		}
		const json = (await res.json()) as {
			choices: Array<{ message: { content: string | null } }>;
			usage?: { prompt_tokens?: number; completion_tokens?: number };
		};
		const content = json.choices?.[0]?.message?.content ?? '';
		return {
			content,
			tokensIn: json.usage?.prompt_tokens,
			tokensOut: json.usage?.completion_tokens,
			raw: json
		};
	}
};
