import { EmbeddingProvider } from './base';

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly providerName = 'openai';
  readonly modelName: string;
  readonly dimension: number;
  private apiKey: string;

  constructor(apiKey?: string, modelName?: string, dimension?: number) {
    this.apiKey = apiKey || process.env.EMBEDDING_API_KEY || '';
    this.modelName = modelName || process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
    this.dimension = dimension || 1536;

    if (!this.apiKey) {
      console.warn('주의: EMBEDDING_API_KEY가 설정되지 않았습니다. OpenAI 임베딩 호출 시 오류가 발생할 수 있습니다.');
    }
  }

  async embedText(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    return results[0];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      throw new Error('OpenAI 임베딩 API 키가 누락되었습니다. .env.local에 EMBEDDING_API_KEY를 설정하세요.');
    }

    // 빈 텍스트 방어
    const sanitizedTexts = texts.map((t) => (t.trim() ? t : ' '));

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        input: sanitizedTexts,
        model: this.modelName,
        dimensions: this.dimension,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`OpenAI Embedding API 오류 (${response.status}): ${errBody}`);
    }

    const data = await response.json();
    // data.data 배열을 인덱스 순서대로 정렬하여 반환
    const sorted = data.data.sort((a: any, b: any) => a.index - b.index);
    return sorted.map((item: any) => item.embedding);
  }
}
