import { LLMProvider } from './types';
import { OpenAILLMProvider } from './openai-provider';
import { MockLLMProvider } from './mock-provider';

export * from './types';
export * from './openai-provider';
export * from './mock-provider';

let cachedProvider: LLMProvider | null = null;

export function getLLMProvider(preferredProvider?: string): LLMProvider {
  if (cachedProvider && !preferredProvider) {
    return cachedProvider;
  }

  const providerType = (
    preferredProvider ||
    process.env.LLM_PROVIDER ||
    (process.env.OPENAI_API_KEY ? 'openai' : 'mock')
  ).toLowerCase();

  if (providerType === 'openai') {
    const key = process.env.OPENAI_API_KEY || process.env.CONTEXT_LLM_API_KEY;
    if (key && key.trim().length > 0) {
      cachedProvider = new OpenAILLMProvider(key);
      return cachedProvider;
    }
    console.warn('[LLMProvider] OpenAI API 키가 없어 MockLLMProvider로 자동 폴백합니다.');
  }

  cachedProvider = new MockLLMProvider();
  return cachedProvider;
}
