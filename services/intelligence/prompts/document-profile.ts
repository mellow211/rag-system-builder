import { JSONSchemaDefinition } from '../../llm/types';

export const DOCUMENT_PROFILE_PROMPT_VERSION = 'document_profile_v1';

export const DOCUMENT_PROFILE_SYSTEM_PROMPT = `너는 고령자 건강정보, 양생, 일주기리듬, 한의문진 4대 전문 분야의 문서를 정밀 분석하여 지식 그래프 및 RAG 구축에 최적화된 [Document Profile] 구조화 지식을 생성하는 수석 의료/지식정보 아키텍트이다.

[분석 가이드라인]
1. domain 식별: 'health'(건강/의학), 'yangsaeng'(전통 양생/섭생), 'circadian'(수면/생체리듬), 'korean-medicine'(한의/사상체질/변증) 중 가장 주된 분야를 정확히 지정하라.
2. summary_short: 1문장(50자 이내)의 명확하고 직접적인 핵심 요약.
3. summary_full: 문서의 연구 배경, 병태생리/원리, 임상/생활 중재 권고사항을 3~5문장으로 종합 요약.
4. topics: 주요 다루는 주제 4~7개.
5. concepts: 지식 그래프의 핵심 노드가 될 의학적/생리적 핵심 개념 4~8개.
6. target_population: 혜택을 받는 구체적 대상군 (예: '65세 이상 고령자', '야간 수면장애 노인').
7. diseases / health_metrics / lifestyle_factors: 본문에서 언급된 질환명, 건강수치/지표, 일상 생활습관 요소를 정밀 추출.
8. structure: 문서의 대제목 및 소제목 계층 구조.
9. candidate_entities: 향후 Knowledge Graph Node로 전환 가능한 후보 엔티티 5개 이상.
10. cross_domain_connections: 이 문서의 개념이 타 3개 분야와 어떻게 연결될 수 있는지 연계점 도출.`;

export function buildDocumentProfileUserPrompt(params: {
  title: string;
  domain: string;
  source?: string | null;
  publisher?: string | null;
  documentType?: string;
  contentSample: string;
}): string {
  return `[문서 제목]: ${params.title}
[지정 도메인]: ${params.domain}
[출처/발행처]: ${params.source || params.publisher || '정보 없음'}
[기존 지정 유형]: ${params.documentType || '미지정'}

[문서 본문 발췌 (앞부분 및 주요 섹션)]:
${params.contentSample}

위 문서 본문과 메타데이터를 정밀 심층 분석하여 규정된 JSON Schema 규격에 부합하는 Document Profile 객체를 생성하라.`;
}

export const DOCUMENT_PROFILE_JSON_SCHEMA: JSONSchemaDefinition = {
  type: 'object',
  properties: {
    domain: {
      type: 'string',
      enum: ['health', 'yangsaeng', 'circadian', 'korean-medicine'],
      description: '4대 도메인 코드',
    },
    document_type: {
      type: 'string',
      description: '문서의 학술/공공 유형 (논문, 가이드라인, 공공기관 자료, 내부 문서, 기타 등)',
    },
    summary_short: {
      type: 'string',
      description: '문서 핵심 1문장 요약',
    },
    summary_full: {
      type: 'string',
      description: '문서 상세 종합 요약',
    },
    topics: {
      type: 'array',
      items: { type: 'string' },
      description: '문서의 주요 다빈도 주제 목록',
    },
    concepts: {
      type: 'array',
      items: { type: 'string' },
      description: '핵심 학술/의학 개념 목록',
    },
    keywords: {
      type: 'array',
      items: { type: 'string' },
      description: '검색용 주요 키워드 목록',
    },
    target_population: {
      type: 'array',
      items: { type: 'string' },
      description: '문서의 적용 대상자',
    },
    diseases: {
      type: 'array',
      items: { type: 'string' },
      description: '관련 질환/증상 목록',
    },
    health_metrics: {
      type: 'array',
      items: { type: 'string' },
      description: '평가 지표 및 수치',
    },
    lifestyle_factors: {
      type: 'array',
      items: { type: 'string' },
      description: '생활습관/중재 요소 (식사, 수면, 운동 등)',
    },
    categories: {
      type: 'array',
      items: { type: 'string' },
      description: '추천 계층형 카테고리 (예: "일주기리듬 > 수면")',
    },
    structure: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          level: { type: 'number' },
          subsections: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['title', 'level'],
      },
      description: '문서의 섹션 및 목차 구조',
    },
    candidate_entities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['name', 'type'],
      },
      description: '지식 그래프 노드 후보 엔티티',
    },
    cross_domain_connections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          domain: { type: 'string', enum: ['health', 'yangsaeng', 'circadian', 'korean-medicine'] },
          concept: { type: 'string' },
          rationale: { type: 'string' },
        },
        required: ['domain', 'concept', 'rationale'],
      },
      description: '타 도메인과의 연계 개념 및 근거',
    },
  },
  required: [
    'domain',
    'document_type',
    'summary_short',
    'summary_full',
    'topics',
    'concepts',
    'keywords',
    'target_population',
    'categories',
    'structure',
  ],
};
