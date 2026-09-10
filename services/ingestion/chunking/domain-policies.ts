import { BlockType } from '../parsing/types';

export interface DomainChunkingPolicy {
  domain: string;
  prioritizedBlockTypes: BlockType[];
  allowOversizeForSemanticUnit: boolean;
  minTokensAdjustment: number;
  specialRulesDescription: string;
}

export const DOMAIN_CHUNKING_POLICIES: Record<string, DomainChunkingPolicy> = {
  health: {
    domain: 'health',
    prioritizedBlockTypes: ['guideline', 'definition', 'heading'],
    allowOversizeForSemanticUnit: true,
    minTokensAdjustment: 0,
    specialRulesDescription: '임상 가이드라인, 대상 연령별 권고사항 및 주의사항 조건-결론 결합 보존',
  },
  yangsaeng: {
    domain: 'yangsaeng',
    prioritizedBlockTypes: ['list', 'guideline'],
    allowOversizeForSemanticUnit: true,
    minTokensAdjustment: -20, // 짧은 섭생 수칙도 온전히 보존
    specialRulesDescription: '전통 양생 수칙, 식이 요법 목록 및 계절별 섭생 지침 목록 단위 보존',
  },
  circadian: {
    domain: 'circadian',
    prioritizedBlockTypes: ['paragraph', 'table'],
    allowOversizeForSemanticUnit: true,
    minTokensAdjustment: 0,
    specialRulesDescription: '수면 위생 과학적 근거 단락, 조도/시간대별 생체리듬 통계 표 구조 보존',
  },
  'korean-medicine': {
    domain: 'korean-medicine',
    prioritizedBlockTypes: ['qa', 'definition'],
    allowOversizeForSemanticUnit: true,
    minTokensAdjustment: -30, // 독립 문진 문항 보존
    specialRulesDescription: '한의학 변증 문진표의 질문, 부가 설명, 선택지, 판정 기준 100% 단일 청크 유지',
  },
};

export function getDomainChunkingPolicy(domain: string): DomainChunkingPolicy {
  return DOMAIN_CHUNKING_POLICIES[domain] || DOMAIN_CHUNKING_POLICIES.health;
}
