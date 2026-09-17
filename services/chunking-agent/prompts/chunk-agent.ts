export const CHUNK_AGENT_PROMPT_VERSION = 'chunk_agent_v2';

export const CHUNK_AGENT_SYSTEM_PROMPT = `너는 고령자 건강정보 RAG 지식 구축 플랫폼의 [Chunk 설계 전문 수석 AI 에이전트]이다.
사용자의 전문지식과 의도를 적극 반영하여 문서 구조를 분석하고 검색 성능을 극대화하는 최적의 청크 구조(Chunk Plan)를 대화형으로 설계하고 **실제 청크를 수정(Mutate)**하라.

[핵심 행동 원칙]
1. 단순히 친절하게 대답만 하지 말고, 사용자의 의도에 따라 반드시 실제 청크를 수정하는 'actions'를 JSON으로 반환하라!
2. 복합 지시 처리 (Multi-action): 사용자가 한 문장에서 여러 작업을 지시하거나 범위를 지정할 경우, actions 배열에 순서대로 모두 포함하라:
   - "3번부터 6번까지 연구방법으로 바꿔줘":
     actions: [{ type: 'change_category', chunk_indices: [3, 4, 5, 6], new_category: '연구방법' }]
   - "2번 청크 제목을 '피험자 선정 기준'으로 바꾸고 카테고리도 연구방법으로 수정해줘":
     actions: [{ type: 'rename', chunk_index: 2, new_title: '피험자 선정 기준' }, { type: 'change_category', chunk_indices: [2], new_category: '연구방법' }]
   - "서론으로 된 것들 내용에 맞게 재분류해줘" 또는 "전체 카테고리 다시 분류해줘":
     actions: [{ type: 'reclassify_all', categories_map: { 1: '초록', 2: '서론', 3: '연구방법', 4: '연구방법', 5: '연구결과', 6: '고찰', 7: '결론' } }]
   - "1번과 2번 청크 합쳐줘":
     actions: [{ type: 'merge', chunk_indices: [1, 2], new_title: '통합된 청크 제목' }]
   - "4번 청크 2개로 나눠줘":
     actions: [{ type: 'split', chunk_index: 4, sub_titles: ['하위 주제 1', '하위 주제 2'] }]
   - "이대로 승인해줘":
     actions: [{ type: 'approve_all' }]
3. reply_message에는 어떤 청크(번호, 제목, 카테고리)가 구체적으로 어떻게 수정되었는지 사용자가 명확히 확인할 수 있도록 친절히 보고하라.`;

export interface ChunkAgentActionItem {
  type: 'change_category' | 'rename' | 'split' | 'merge' | 'update_chunk' | 'reclassify_all' | 'approve' | 'approve_all' | 'none';
  chunk_index?: number;
  chunk_indices?: number[];
  new_title?: string;
  new_category?: string;
  sub_titles?: string[];
  categories_map?: Record<string, string>;
  titles_map?: Record<string, string>;
}

export interface ChunkAgentActionDecision {
  thought: string;
  action?: 'split' | 'merge' | 'rename' | 'change_category' | 'approve_all' | 'none';
  action_params?: {
    chunk_index?: number;
    chunk_indices?: number[];
    new_title?: string;
    sub_titles?: string[];
    new_category?: string;
  };
  actions?: ChunkAgentActionItem[];
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
      description: '단일 기본 액션 (호환성용)',
    },
    action_params: {
      type: 'object',
      properties: {
        chunk_index: { type: 'number', description: '작업 대상 단일 청크 번호' },
        chunk_indices: {
          type: 'array',
          items: { type: 'number' },
          description: '작업 대상 청크 번호 목록 (범위 포함)',
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
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['change_category', 'rename', 'split', 'merge', 'update_chunk', 'reclassify_all', 'approve', 'approve_all', 'none'],
            description: '실행할 개별 도구 액션',
          },
          chunk_index: { type: 'number', description: '단일 대상 청크 번호' },
          chunk_indices: {
            type: 'array',
            items: { type: 'number' },
            description: '복수 대상 청크 번호 목록',
          },
          new_title: { type: 'string', description: '새 제목' },
          new_category: { type: 'string', description: '새 카테고리' },
          sub_titles: {
            type: 'array',
            items: { type: 'string' },
            description: '분할 시 하위 제목들',
          },
          categories_map: {
            type: 'object',
            description: '청크 인덱스(문자열 키)별 새 카테고리 매핑 객체 (예: {"1": "서론", "2": "연구방법"})',
          },
        },
        required: ['type'],
      },
      description: '순차 실행할 1개 이상의 구체적인 청크 조작 액션 목록',
    },
    reply_message: {
      type: 'string',
      description: '사용자에게 전달할 정중하고 구체적인 작업 완료 보고 메시지',
    },
  },
  required: ['thought', 'reply_message'],
};
