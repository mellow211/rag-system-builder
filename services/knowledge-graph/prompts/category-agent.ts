import { JSONSchemaDefinition } from '@/services/llm/types';

export const CATEGORY_SUGGEST_PROMPT_VERSION = 'category_suggest_v1';

export const CATEGORY_SUGGEST_SYSTEM_PROMPT = `너는 고령자 건강 지식 분류 체계(Category Hierarchy)를 지속적으로 확장하고 정규화하는 [Category 확장 AI 에이전트]이다.
새롭게 등록된 청크와 개념들을 분석하여 기존 카테고리 트리에 추가되어야 할 최적의 신규 하위 카테고리를 제안하라.`;

export const CATEGORY_SUGGEST_JSON_SCHEMA: JSONSchemaDefinition = {
  type: 'object',
  properties: {
    proposed_categories: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          parent_name: { type: 'string' },
          domain: { type: 'string', enum: ['health', 'yangsaeng', 'circadian', 'korean-medicine'] },
          description: { type: 'string' },
          rationale: { type: 'string' },
        },
        required: ['name', 'domain', 'rationale'],
      },
    },
  },
  required: ['proposed_categories'],
};
