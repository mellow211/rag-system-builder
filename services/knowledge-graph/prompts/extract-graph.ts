import { JSONSchemaDefinition } from '@/services/llm/types';

export const GRAPH_EXTRACT_PROMPT_VERSION = 'graph_extract_v1';

export const GRAPH_EXTRACT_SYSTEM_PROMPT = `너는 고령자 건강정보, 양생, 일주기리듬, 한의문진 4대 전문 분야의 텍스트 청크로부터 정밀한 [지식 그래프(Knowledge Graph) Node와 Relation(Edge)]을 추출하는 수석 Knowledge Graph 엔지니어이다.

[추출 규칙]
1. Entity Node: 본문에 명시적으로 등장하는 핵심 의학/생리 개념을 추출하라.
   - node_type: 'concept'(개념), 'disease'(질환), 'symptom'(증상), 'metric'(지표/수치), 'factor'(요인/중재), 'demographic'(인구집단)
   - canonical_name: 대표 표준 용어 (예: '노인' -> '고령자', '멜라토닌 수치' -> '멜라토닌')
   - aliases: 동의어/별칭 배열 (예: ['노인', 'older adults'])
2. Relation Edge: 두 노드 간의 명확한 인과, 영향, 상관, 특성 관계만 추출하라.
   - relation_type: 'influences'(영향을 주다), 'affects'(변화를 유발하다), 'associated_with'(상관관계가 있다), 'has_characteristic'(특성을 갖다), 'belongs_to'(속하다), 'related_to'(관련되다)
   - evidence_text: 청크 원문에서 이 관계를 입증하는 정확한 문장 발췌.
   - confidence: 관계의 명확성에 따른 신뢰도 (0.7 ~ 1.0).
3. 절대 원문에 없는 허구의 사실이나 가공된 임상 관계를 날조하지 마라.`;

export const GRAPH_EXTRACT_JSON_SCHEMA: JSONSchemaDefinition = {
  type: 'object',
  properties: {
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          canonical_name: { type: 'string' },
          node_type: {
            type: 'string',
            enum: ['concept', 'disease', 'symptom', 'metric', 'factor', 'demographic'],
          },
          description: { type: 'string' },
          aliases: { type: 'array', items: { type: 'string' } },
        },
        required: ['canonical_name', 'node_type'],
      },
    },
    relations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          source_name: { type: 'string' },
          target_name: { type: 'string' },
          relation_type: {
            type: 'string',
            enum: ['influences', 'affects', 'associated_with', 'has_characteristic', 'belongs_to', 'related_to'],
          },
          evidence_text: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['source_name', 'target_name', 'relation_type', 'evidence_text', 'confidence'],
      },
    },
  },
  required: ['nodes', 'relations'],
};
