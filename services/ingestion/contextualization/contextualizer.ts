import { Contextualizer } from './types';
import { LLMContextualizer } from './llm-contextualizer';
import { NoOpContextualizer } from './no-op-contextualizer';

export * from './types';
export * from './context-cache';
export * from './no-op-contextualizer';
export * from './llm-contextualizer';

let cachedContextualizer: Contextualizer | null = null;

export function getContextualizer(): Contextualizer {
  if (cachedContextualizer) return cachedContextualizer;

  const isEnabled = process.env.ENABLE_LLM_CONTEXTUALIZATION === 'true';
  const apiKey = process.env.CONTEXT_LLM_API_KEY || process.env.OPENAI_API_KEY;

  if (isEnabled && apiKey) {
    cachedContextualizer = new LLMContextualizer(apiKey);
    return cachedContextualizer;
  }

  // 기본적으로 NoOp(구조 기반 무비용) Contextualizer 활성화
  cachedContextualizer = new NoOpContextualizer();
  return cachedContextualizer;
}
