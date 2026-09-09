export interface EvaluationMetrics {
  totalQuestions: number;
  hitAt1Count: number;
  hitAt3Count: number;
  hitAt5Count: number;
  hitAt1Rate: number;
  hitAt3Rate: number;
  hitAt5Rate: number;
  mrr: number; // Mean Reciprocal Rank (0.0 ~ 1.0)
  avgLatencyMs: number;
}

export interface QuestionEvalResult {
  questionId: string;
  question: string;
  expectedDocumentId?: string;
  expectedChunkId?: string;
  expectedKeywords?: string[];
  retrievedChunkIds: string[];
  retrievedDocIds: string[];
  matchedRank: number | null; // 1-based, null if not in topK
  hitAt1: boolean;
  hitAt3: boolean;
  hitAt5: boolean;
  reciprocalRank: number;
  latencyMs: number;
  topResultTitle?: string;
  topResultContent?: string;
}

/**
 * RAG 검색 평가 지표(Hit@1, Hit@3, Hit@5, MRR, 평균 지연시간) 계산기
 */
export function calculateEvaluationMetrics(
  results: QuestionEvalResult[]
): EvaluationMetrics {
  const n = results.length;
  if (n === 0) {
    return {
      totalQuestions: 0,
      hitAt1Count: 0,
      hitAt3Count: 0,
      hitAt5Count: 0,
      hitAt1Rate: 0,
      hitAt3Rate: 0,
      hitAt5Rate: 0,
      mrr: 0,
      avgLatencyMs: 0,
    };
  }

  let hit1 = 0;
  let hit3 = 0;
  let hit5 = 0;
  let rrSum = 0;
  let latencySum = 0;

  for (const r of results) {
    if (r.hitAt1) hit1++;
    if (r.hitAt3) hit3++;
    if (r.hitAt5) hit5++;
    rrSum += r.reciprocalRank;
    latencySum += r.latencyMs;
  }

  return {
    totalQuestions: n,
    hitAt1Count: hit1,
    hitAt3Count: hit3,
    hitAt5Count: hit5,
    hitAt1Rate: parseFloat((hit1 / n).toFixed(4)),
    hitAt3Rate: parseFloat((hit3 / n).toFixed(4)),
    hitAt5Rate: parseFloat((hit5 / n).toFixed(4)),
    mrr: parseFloat((rrSum / n).toFixed(4)),
    avgLatencyMs: Math.round(latencySum / n),
  };
}
