import type { AssistantDoc } from './types.js';

/**
 * Generate a per-assistant OpenAPI 3.1 document describing the conversation
 * lifecycle endpoints. External tools (Cursor skills, Claude Code, OpenAI
 * Actions, etc.) consume this to know how to call the API.
 *
 * Conversation model:
 *   1. POST /conversations               → create an empty conversation, get {id}
 *   2. POST /conversations/{id}/messages → append user message(s), receive assistant reply
 *   3. GET  /conversations/{id}          → fetch full transcript (useful to resume)
 *
 * Also exposed: POST /chat — a stateless shortcut that auto-creates a
 * conversation for callers who don't need to manage threads.
 */
export function buildOpenApiSpec(args: {
	assistant: AssistantDoc;
	baseUrl: string; // e.g. https://prompt-to-api.web.app/v1
}): Record<string, unknown> {
	const { assistant, baseUrl } = args;
	const shortPrompt = assistant.systemPrompt.trim().slice(0, 240);
	const aid = assistant.id;

	return {
		openapi: '3.1.0',
		info: {
			title: assistant.name,
			version: '1.0.0',
			description: [
				`Auto-generated API for the "${assistant.name}" assistant.`,
				'',
				'Provider: ' + assistant.provider + ' · Model: `' + assistant.model + '`',
				'',
				'System prompt excerpt:',
				'',
				'> ' + shortPrompt.replace(/\n+/g, ' '),
				'',
				'Usage:',
				'',
				'1. `POST /assistants/' + aid + '/conversations` to create a thread.',
				'2. `POST /assistants/' + aid + '/conversations/{conversationId}/messages` to chat.',
				'3. `GET  /assistants/' + aid + '/conversations/{conversationId}` to replay.'
			].join('\n'),
			'x-prompt-to-api': {
				assistantId: aid,
				provider: assistant.provider,
				model: assistant.model
			}
		},
		servers: [{ url: baseUrl }],
		components: {
			securitySchemes: {
				bearerAuth: {
					type: 'http',
					scheme: 'bearer',
					bearerFormat: 'pta_live_*',
					description:
						'Per-assistant API token. Create one in the dashboard → your assistant → Tokens.'
				}
			},
			schemas: {
				Message: {
					type: 'object',
					required: ['role', 'content'],
					properties: {
						role: { type: 'string', enum: ['user', 'assistant'] },
						content: { type: 'string' }
					}
				},
				Usage: {
					type: 'object',
					properties: {
						tokensIn: { type: 'integer', nullable: true },
						tokensOut: { type: 'integer', nullable: true }
					}
				},
				Conversation: {
					type: 'object',
					required: ['id', 'createdAt', 'updatedAt', 'messageCount'],
					properties: {
						id: { type: 'string' },
						title: { type: 'string' },
						createdAt: { type: 'integer', description: 'ms since epoch' },
						updatedAt: { type: 'integer', description: 'ms since epoch' },
						messageCount: { type: 'integer' }
					}
				},
				CreateConversationRequest: {
					type: 'object',
					properties: {
						title: {
							type: 'string',
							description: 'Optional human-readable title shown in the dashboard.'
						}
					}
				},
				AppendMessagesRequest: {
					type: 'object',
					required: ['messages'],
					properties: {
						messages: {
							type: 'array',
							items: { $ref: '#/components/schemas/Message' },
							minItems: 1,
							description: 'New user/assistant messages to append to the thread. Typically a single user message.'
						}
					}
				},
				AppendMessagesResponse: {
					type: 'object',
					required: ['conversationId', 'message'],
					properties: {
						conversationId: { type: 'string' },
						message: { $ref: '#/components/schemas/Message' },
						usage: { $ref: '#/components/schemas/Usage' }
					}
				},
				ConversationTranscript: {
					allOf: [
						{ $ref: '#/components/schemas/Conversation' },
						{
							type: 'object',
							properties: {
								messages: {
									type: 'array',
									items: {
										allOf: [
											{ $ref: '#/components/schemas/Message' },
											{
												type: 'object',
												properties: {
													id: { type: 'string' },
													createdAt: { type: 'integer' },
													tokensIn: { type: 'integer', nullable: true },
													tokensOut: { type: 'integer', nullable: true }
												}
											}
										]
									}
								}
							}
						}
					]
				},
				ChatShortcutRequest: {
					type: 'object',
					required: ['messages'],
					properties: {
						conversationId: {
							type: 'string',
							nullable: true,
							default: '',
							example: '',
							description:
								'Optional. Leave empty / omit to auto-create a new conversation. If provided, messages are appended to that existing conversation. (In Swagger UI, clear this field — the pre-filled placeholder "string" is not a valid id.)'
						},
						messages: {
							type: 'array',
							items: { $ref: '#/components/schemas/Message' },
							minItems: 1
						}
					}
				},
				Error: {
					type: 'object',
					properties: {
						error: { type: 'string' },
						code: { type: 'string' }
					}
				}
			}
		},
		security: [{ bearerAuth: [] }],
		paths: {
			[`/assistants/${aid}/conversations`]: {
				post: {
					operationId: 'createConversation',
					summary: `Create a new conversation thread with "${assistant.name}"`,
					description:
						'Creates an empty conversation and returns its ID. Pass that ID to `appendMessages` to chat.',
					requestBody: {
						required: false,
						content: {
							'application/json': {
								schema: { $ref: '#/components/schemas/CreateConversationRequest' }
							}
						}
					},
					responses: {
						'201': {
							description: 'Created',
							content: {
								'application/json': { schema: { $ref: '#/components/schemas/Conversation' } }
							}
						}
					}
				}
			},
			[`/assistants/${aid}/conversations/{conversationId}`]: {
				parameters: [
					{
						name: 'conversationId',
						in: 'path',
						required: true,
						schema: { type: 'string' }
					}
				],
				get: {
					operationId: 'getConversation',
					summary: 'Replay an existing conversation',
					description:
						'Returns the full ordered transcript of the conversation so external tools can resume exactly where they left off.',
					responses: {
						'200': {
							description: 'Conversation transcript',
							content: {
								'application/json': {
									schema: { $ref: '#/components/schemas/ConversationTranscript' }
								}
							}
						},
						'404': {
							description: 'Not found',
							content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
						}
					}
				},
				delete: {
					operationId: 'deleteConversation',
					summary: 'Delete a conversation',
					responses: {
						'204': { description: 'Deleted' },
						'404': {
							description: 'Not found',
							content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
						}
					}
				}
			},
			[`/assistants/${aid}/conversations/{conversationId}/messages`]: {
				parameters: [
					{
						name: 'conversationId',
						in: 'path',
						required: true,
						schema: { type: 'string' }
					}
				],
				post: {
					operationId: 'appendMessages',
					summary: `Continue a thread with "${assistant.name}"`,
					description:
						'Appends new user message(s) to the thread. The server loads the existing transcript, calls the underlying LLM with the full context, persists the assistant reply, and returns it.',
					requestBody: {
						required: true,
						content: {
							'application/json': {
								schema: { $ref: '#/components/schemas/AppendMessagesRequest' }
							}
						}
					},
					responses: {
						'200': {
							description: 'Assistant reply',
							content: {
								'application/json': {
									schema: { $ref: '#/components/schemas/AppendMessagesResponse' }
								}
							}
						},
						'400': {
							description: 'Bad request',
							content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
						},
						'404': {
							description: 'Conversation or assistant not found',
							content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
						}
					}
				}
			},
			[`/assistants/${aid}/chat`]: {
				post: {
					operationId: 'chat',
					summary: `One-shot chat shortcut for "${assistant.name}"`,
					description:
						'Convenience endpoint. If `conversationId` is omitted, the server creates a new conversation automatically. The response always includes `conversationId` so callers can continue the thread later by calling `appendMessages` or by passing the same `conversationId` back here.',
					requestBody: {
						required: true,
						content: {
							'application/json': {
								schema: { $ref: '#/components/schemas/ChatShortcutRequest' }
							}
						}
					},
					responses: {
						'200': {
							description: 'Assistant reply',
							content: {
								'application/json': {
									schema: { $ref: '#/components/schemas/AppendMessagesResponse' }
								}
							}
						}
					}
				}
			}
		}
	};
}
