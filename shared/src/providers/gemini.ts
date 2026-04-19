import type { ChatProvider, ProviderChatRequest, ProviderChatResponse } from '../types.js';

function endpoint(model: string, apiKey: string): string {
	return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
		model
	)}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

export const geminiProvider: ChatProvider = {
	id: 'gemini',
	async chat(req: ProviderChatRequest): Promise<ProviderChatResponse> {
		const contents = req.messages
			.filter((m) => m.role !== 'system')
			.map((m) => ({
				role: m.role === 'assistant' ? 'model' : 'user',
				parts: [{ text: m.content }]
			}));

		const body = {
			systemInstruction: { parts: [{ text: req.systemPrompt }] },
			generationConfig: {
				temperature: req.temperature,
				maxOutputTokens: req.maxTokens
			},
			contents
		};

		const res = await fetch(endpoint(req.model, req.apiKey), {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});

		if (!res.ok) {
			const text = await res.text();
			throw new Error(`gemini ${res.status}: ${text.slice(0, 500)}`);
		}
		const json = (await res.json()) as {
			candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
			usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
		};
		const parts = json.candidates?.[0]?.content?.parts ?? [];
		const content = parts
			.map((p) => p.text ?? '')
			.filter((t) => t.length > 0)
			.join('\n');
		return {
			content,
			tokensIn: json.usageMetadata?.promptTokenCount,
			tokensOut: json.usageMetadata?.candidatesTokenCount,
			raw: json
		};
	}
};
