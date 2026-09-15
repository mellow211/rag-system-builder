export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface JSONSchemaDefinition {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  items?: Record<string, unknown>;
  description?: string;
  [key: string]: unknown;
}

export interface LLMStructuredRequest {
  systemPrompt?: string;
  prompt: string;
  schemaName: string;
  schema: JSONSchemaDefinition;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface LLMTextRequest {
  systemPrompt?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface LLMProvider {
  readonly providerName: string;
  readonly defaultModel: string;
  generateStructured<T>(req: LLMStructuredRequest): Promise<T>;
  generateText(req: LLMTextRequest): Promise<string>;
}
