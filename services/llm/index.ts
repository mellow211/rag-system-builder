import { LLMProvider } from './types';
import { OpenAILLMProvider } from './openai-provider';
import { ReplicateLLMProvider } from './replicate-provider';
import { MockLLMProvider } from './mock-provider';

export * from './types';
export * from './openai-provider';
export * from './replicate-provider';
export * from './mock-provider';

let cachedProvider: LLMProvider | null = null;

export function getLLMProvider(preferredProvider?: string): LLMProvider {
  if (cachedProvider && !preferredProvider) {
    return cachedProvider;
  }

  const openAiKey = process.env.OPENAI_API_KEY || process.env.CONTEXT_LLM_API_KEY;
  const hasOpenAI = !!(openAiKey && openAiKey.trim().length > 5);

  const replicateToken = process.env.REPLICATE_API_TOKEN;
  const hasReplicate = !!(replicateToken && replicateToken.trim().length > 5);

  let targetType = preferredProvider || process.env.LLM_PROVIDER;

  // 자동 우선순위:
  // 1. 명시적 요청
  // 2. OpenAI 키 존재 시 openai (gpt-4o-mini)
  // 3. Replicate 토큰 존재 시 replicate (meta-llama-3-8b-instruct)
  // 4. Mock 폴백
  if (!targetType) {
    if (hasOpenAI) {
      targetType = 'openai';
    } else if (hasReplicate) {
      targetType = 'replicate';
    } else {
      targetType = 'mock';
    }
  }

  targetType = targetType.toLowerCase();

  if (targetType === 'openai') {
    if (hasOpenAI) {
      cachedProvider = new OpenAILLMProvider(openAiKey);
      console.log('[LLMProvider] OpenAI Provider 활성화 (모델: gpt-4o-mini)');
      return cachedProvider;
    }
    console.warn('[LLMProvider] OpenAI API 키가 없어 다음 공급자로 폴백합니다.');
  }

  if (targetType === 'replicate' || hasReplicate) {
    if (hasReplicate) {
      cachedProvider = new ReplicateLLMProvider(replicateToken);
      console.log('[LLMProvider] Replicate LLM Provider 활성화 (모델: meta/meta-llama-3-8b-instruct)');
      return cachedProvider;
    }
    console.warn('[LLMProvider] REPLICATE_API_TOKEN이 없어 MockLLMProvider로 폴백합니다.');
  }

  console.log('[LLMProvider] MockLLMProvider 활성화 (테스트/오프라인 모드)');
  cachedProvider = new MockLLMProvider();
  return cachedProvider;
}
