import { normalizeQuery } from './normalize-query';
import { RAG_CONFIG } from '@/lib/rag/config';

export interface QueryRewriteResult {
  originalQuery: string;
  rewrittenQuery: string;
  isRewritten: boolean;
  rewriteReason?: string;
}

// 한국어 고령자 건강/양생/일주기리듬/한의문진 전문 어휘 매핑 사전
const MEDICAL_TERM_MAP: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /밤에\s*(자꾸\s*)?깨/g, replacement: '야간 각성 수면 유지 장애' },
  { pattern: /잠이\s*안\s*와|잠을\s*못\s*자/g, replacement: '노년기 불면증 입면 장애 수면 위생' },
  { pattern: /햇(볕|빛)\s*(쬐|노출)/g, replacement: '아침 자연광 노출 멜라토닌 생체시계 동기화' },
  { pattern: /낮잠/g, replacement: '낮잠 시간 야간 수면 질 상관관계' },
  { pattern: /혈당/g, replacement: '공복혈당 당화혈색소(HbA1c) 관리' },
  { pattern: /노인(들)?/g, replacement: '고령자' },
  { pattern: /동의보감/g, replacement: '동의보감(東醫寶鑑) 양생의학' },
  { pattern: /체온\s*관리/g, replacement: '체온 조절 및 환절기 섭생 원칙' },
  { pattern: /소화가\s*안\s*돼|소화\s*안\s*될\s*때/g, replacement: '소화기능 저하 비위허약(脾胃虛弱) 대처법' },
  { pattern: /어지러(워|움)/g, replacement: '어지럼증(眩暈) 한의학 문진 지표' },
  { pattern: /기운이\s*없(어|음)/g, replacement: '기혈허약(氣血虛弱) 변증' },
];

/**
 * 구어체 사용자 질문을 학술 및 전문 문헌 검색에 최적화된 용어로 재작성(Rewrite)합니다.
 */
export async function rewriteQuery(
  rawQuery: string,
  options?: { enableRewrite?: boolean }
): Promise<QueryRewriteResult> {
  const normalized = normalizeQuery(rawQuery);
  const enable = options?.enableRewrite ?? RAG_CONFIG.enableQueryRewrite;

  if (!enable || !normalized) {
    return {
      originalQuery: rawQuery,
      rewrittenQuery: normalized || rawQuery,
      isRewritten: false,
    };
  }

  let rewritten = normalized;
  let hasReplaced = false;

  for (const item of MEDICAL_TERM_MAP) {
    if (item.pattern.test(rewritten)) {
      rewritten = rewritten.replace(item.pattern, item.replacement);
      hasReplaced = true;
    }
  }

  return {
    originalQuery: rawQuery,
    rewrittenQuery: hasReplaced ? rewritten.trim() : normalized,
    isRewritten: hasReplaced,
    rewriteReason: hasReplaced ? '고령자 의학/건강정보 전문 어휘 및 동의어 매핑' : undefined,
  };
}
