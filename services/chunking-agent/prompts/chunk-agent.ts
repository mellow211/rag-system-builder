export const CHUNK_AGENT_PROMPT_VERSION = 'chunk_agent_v1';

export const CHUNK_AGENT_SYSTEM_PROMPT = `너는 고령자 건강정보 RAG 지식 구축 플랫폼의 [Chunk 설계 전문 수석 AI 에이전트]이다.
사용자의 전문지식과 의도를 반영하여 문서 구조를 분석하고 검색 성능을 극대화하는 최적의 청크 구조(Chunk Plan)를 대화형으로 설계하라.

[행동 및 도구 호출 지침]
1. 사용자의 자연어 요청을 분석하여 적절한 action을 결정하라:
   - "split": 특정 청크가 너무 길거나 세부 주제가 섞여 있어 나눌 때 (chunk_index, sub_titles 지정)
   - "merge": 내용이 짧거나 연속된 청크들을 하나로 묶을 때 (chunk_indices, new_title 지정)
   - "rename": 특정 청크의 대표 제목을 더 검색 친화적으로 바꿀 때 (chunk_index, new_title 지정)
   - "change_category": 특정 청크의 카테고리를 재지정할 때 (chunk_index, new_category 지정)
   - "approve_all": 사용자가 승인/확정/적용을 원할 때
   - "none": 조작 없이 질문에 답변하거나 청킹 조언/분석 설명만 제공할 때
2. 항상 정중하고 명확한 한국어로 사용자에게 친절히 응답하라.
3. 실행된 작업의 효과와 청크 수 변화를 사용자 친화적으로 명시하라.`;

export interface ChunkAgentActionDecision {
  thought: string;
  action: 'split' | 'merge' | 'rename' | 'change_category' | 'approve_all' | 'none';
  action_params?: {
    chunk_index?: number;
    chunk_indices?: number[];
    new_title?: string;
    sub_titles?: string[];
    new_category?: string;
  };
  reply_message: string;
}

export const CHUNK_AGENT_DECISION_SCHEMA = {
  type: 'object',
  properties: {
    thought: {
      type: 'string',
      description: '에이전트의 상황 판단 및 사용자 요청 의도 분석 추론 과정',
    },
    action: {
      type: 'string',
      enum: ['split', 'merge', 'rename', 'change_category', 'approve_all', 'none'],
      description: '실행할 청크 조작 도구 액션',
    },
    action_params: {
      type: 'object',
      properties: {
        chunk_index: { type: 'number', description: '작업 대상 단일 청크 번호' },
        chunk_indices: {
          type: 'array',
          items: { type: 'number' },
          description: '병합 대상 청크 번호 목록',
        },
        new_title: { type: 'string', description: '새로 지정할 제목' },
        sub_titles: {
          type: 'array',
          items: { type: 'string' },
          description: '분할 시 부여할 하위 청크 제목 목록',
        },
        new_category: { type: 'string', description: '새로 지정할 카테고리 명칭' },
      },
    },
    reply_message: {
      type: 'string',
      description: '사용자에게 전달할 정중하고 전문적인 한국어 응답 메시지',
    },
  },
  required: ['thought', 'action', 'reply_message'],
};
