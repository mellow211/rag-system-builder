import { EmbeddingProvider } from './base';
import { OpenAIEmbeddingProvider } from './openai-provider';
import { GeminiEmbeddingProvider } from './gemini-provider';
import { MockEmbeddingProvider } from './mock-provider';

export * from './base';
export * from './mock-provider';
export * from './openai-provider';
export * from './gemini-provider';

let cachedProvider: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (cachedProvider) return cachedProvider;

  const providerType = (process.env.EMBEDDING_PROVIDER || 'mock').toLowerCase();
  const apiKey = process.env.EMBEDDING_API_KEY;

  if (providerType === 'openai') {
    if (apiKey && apiKey.trim().length > 0) {
      cachedProvider = new OpenAIEmbeddingProvider(apiKey);
      return cachedProvider;
    }
    console.warn('[Embedding] OpenAI 프로바이더가 지정되었으나 API 키가 없습니다. Mock 프로바이더로 대체합니다.');
  } else if (providerType === 'gemini') {
    if (apiKey && apiKey.trim().length > 0) {
      cachedProvider = new GeminiEmbeddingProvider(apiKey);
      return cachedProvider;
    }
    console.warn('[Embedding] Gemini 프로바이더가 지정되었으나 API 키가 없습니다. Mock 프로바이더로 대체합니다.');
  }

  // 기본값: Mock 프로바이더 (API 키 없이도 1536차원 단위 벡터 생성)
  cachedProvider = new MockEmbeddingProvider();
  return cachedProvider;
}
