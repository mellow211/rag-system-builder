import { LLMProvider, LLMStructuredRequest, LLMTextRequest } from './types';

export class OpenAILLMProvider implements LLMProvider {
  readonly providerName = 'openai';
  readonly defaultModel: string;
  private apiKey: string;

  constructor(apiKey?: string, defaultModel?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || process.env.CONTEXT_LLM_API_KEY || '';
    this.defaultModel = defaultModel || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }

  async generateStructured<T>(req: LLMStructuredRequest): Promise<T> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
    }

    const model = req.model || this.defaultModel;
    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];

    if (req.systemPrompt) {
      messages.push({ role: 'system', content: req.systemPrompt });
    }
    messages.push({ role: 'user', content: req.prompt });

    // OpenAI Structured Outputs 지원 (JSON Schema)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: req.temperature ?? 0.1,
        max_tokens: req.maxTokens ?? 2500,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: req.schemaName,
            schema: req.schema,
            strict: false,
          },
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      // json_schema 미지원 구형 모델 fallback: json_object
      if (response.status === 400 && errText.includes('response_format')) {
        return this.fallbackJsonObject<T>(model, messages, req);
      }
      throw new Error(`OpenAI API 오류 (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI 응답에 본문 내용이 없습니다.');
    }

    return JSON.parse(content) as T;
  }

  private async fallbackJsonObject<T>(
    model: string,
    messages: Array<{ role: 'system' | 'user'; content: string }>,
    req: LLMStructuredRequest
  ): Promise<T> {
    const appendedPrompt = `\n\n반드시 아래 JSON 스키마 규격에 부합하는 순수 JSON만 반환하라:\n${JSON.stringify(req.schema, null, 2)}`;
    const updatedMessages = messages.map((m, idx) =>
      idx === messages.length - 1 ? { ...m, content: m.content + appendedPrompt } : m
    );

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: updatedMessages,
        temperature: req.temperature ?? 0.1,
        max_tokens: req.maxTokens ?? 2500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI Fallback JSON 오류 (${response.status}): ${err}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    return JSON.parse(content) as T;
  }

  async generateText(req: LLMTextRequest): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
    }

    const model = req.model || this.defaultModel;
    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];

    if (req.systemPrompt) {
      messages.push({ role: 'system', content: req.systemPrompt });
    }
    messages.push({ role: 'user', content: req.prompt });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: req.temperature ?? 0.2,
        max_tokens: req.maxTokens ?? 2000,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI Text API 오류 (${response.status}): ${err}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
  }
}
