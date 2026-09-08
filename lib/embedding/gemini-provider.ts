import { EmbeddingProvider } from './base';

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly providerName = 'gemini';
  readonly modelName: string;
  readonly dimension: number;
  private apiKey: string;

  constructor(apiKey?: string, modelName?: string, dimension?: number) {
    this.apiKey = apiKey || process.env.EMBEDDING_API_KEY || '';
    this.modelName = modelName || process.env.EMBEDDING_MODEL || 'text-embedding-004';
    this.dimension = dimension || 1536;
  }

  async embedText(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error('Gemini API 키가 누락되었습니다. .env.local에 EMBEDDING_API_KEY를 설정하세요.');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:embedContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${this.modelName}`,
        content: { parts: [{ text: text || ' ' }] },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini Embedding API 오류 (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data.embedding.values;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    // 순차 또는 병렬 호출
    const results: number[][] = [];
    for (const t of texts) {
      results.push(await this.embedText(t));
    }
    return results;
  }
}
