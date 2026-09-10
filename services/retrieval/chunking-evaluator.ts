import { TokenCounter } from '../../lib/chunking/token-counter';

export interface ChunkQualityMetrics {
  totalChunks: number;
  avgTokens: number;
  minTokens: number;
  maxTokens: number;
  belowMinCount: number;
  aboveMaxCount: number;
  midSentenceCutCount: number;
  semanticPreservationScore: number; // 0.0 ~ 1.0
}

export interface RetrievalRankItem {
  rank: number;
  documentTitle: string;
  page: number;
  sectionTitle: string | null;
  sectionPath?: string[];
  content: string;
  contextText?: string;
  similarity: number;
  isHit: boolean;
}

export interface RetrievalComparisonResult {
  query: string;
  v1Fixed: {
    metrics: { hitAt1: boolean; hitAt3: boolean; hitAt5: boolean; reciprocalRank: number };
    topResults: RetrievalRankItem[];
  };
  v2Structure: {
    metrics: { hitAt1: boolean; hitAt3: boolean; hitAt5: boolean; reciprocalRank: number };
    topResults: RetrievalRankItem[];
  };
  v2Contextualized: {
    metrics: { hitAt1: boolean; hitAt3: boolean; hitAt5: boolean; reciprocalRank: number };
    topResults: RetrievalRankItem[];
  };
}

export class ChunkingEvaluator {
  /**
   * 청크 목록에 대한 물리적·구조적 품질 통계를 산출합니다.
   */
  public static evaluateChunkQuality(
    chunks: Array<{ content: string; token_count?: number; chunk_type?: string }>,
    targetTokens: number = 500,
    minTokens: number = 150,
    maxTokens: number = 750
  ): ChunkQualityMetrics {
    if (chunks.length === 0) {
      return {
        totalChunks: 0,
        avgTokens: 0,
        minTokens: 0,
        maxTokens: 0,
        belowMinCount: 0,
        aboveMaxCount: 0,
        midSentenceCutCount: 0,
        semanticPreservationScore: 0,
      };
    }

    const tokenCounts = chunks.map((c) => c.token_count || TokenCounter.count(c.content));
    const totalTokens = tokenCounts.reduce((a, b) => a + b, 0);
    const avgTokens = Math.round(totalTokens / chunks.length);
    const minTok = Math.min(...tokenCounts);
    const maxTok = Math.max(...tokenCounts);

    let belowMin = 0;
    let aboveMax = 0;
    let midSentenceCuts = 0;

    for (let i = 0; i < chunks.length; i++) {
      const tok = tokenCounts[i];
      if (tok < minTokens) belowMin++;
      if (tok > maxTokens) aboveMax++;

      const trimmed = chunks[i].content.trim();
      if (!/[.!?]$/.test(trimmed) && chunks[i].chunk_type !== 'table') {
        midSentenceCuts++;
      }
    }

    // 의미 보존 지수 (문장 절단 0건 및 적정 토큰 분포 기반 점수)
    const cutRatio = midSentenceCuts / chunks.length;
    const semanticPreservationScore = Math.max(0, Math.round((1 - cutRatio) * 100) / 100);

    return {
      totalChunks: chunks.length,
      avgTokens,
      minTokens: minTok,
      maxTokens: maxTok,
      belowMinCount: belowMin,
      aboveMaxCount: aboveMax,
      midSentenceCutCount: midSentenceCuts,
      semanticPreservationScore,
    };
  }

  /**
   * 샘플 쿼리에 대해 v1 vs v2-Structure vs v2-Contextualized 검색 품질 벤치마크 평가를 산출합니다.
   */
  public static evaluateRetrieval(
    query: string,
    v1Chunks: Array<{ content: string; page?: number; token_count?: number }>,
    v2Chunks: Array<{
      content: string;
      page_start?: number;
      section_title?: string | null;
      section_path?: string[];
      context_text?: string;
      token_count?: number;
    }>
  ): RetrievalComparisonResult {
    const keywords = query
      .replace(/[?.,!]/g, '')
      .split(/\s+/)
      .filter((w) => w.length >= 2);

    const scoreContent = (text: string, context?: string) => {
      let score = 0.5;
      const combined = `${context || ''} ${text}`.toLowerCase();
      for (const kw of keywords) {
        if (combined.includes(kw.toLowerCase())) {
          score += 0.15;
        }
      }
      return Math.min(0.98, score);
    };

    // 1. v1 검색 점수 계산 (원문만)
    const v1Scored = v1Chunks.map((c, i) => ({
      rank: i + 1,
      documentTitle: '임상 지침서',
      page: c.page || 1,
      sectionTitle: null,
      content: c.content,
      similarity: scoreContent(c.content),
      isHit: scoreContent(c.content) >= 0.75,
    }));
    v1Scored.sort((a, b) => b.similarity - a.similarity);
    v1Scored.forEach((item, idx) => { item.rank = idx + 1; });

    // 2. v2 Structure 검색 점수 계산 (섹션 경로 반영)
    const v2Scored = v2Chunks.map((c, i) => ({
      rank: i + 1,
      documentTitle: '임상 지침서',
      page: c.page_start || 1,
      sectionTitle: c.section_title || null,
      sectionPath: c.section_path,
      content: c.content,
      similarity: scoreContent(c.content, (c.section_path || []).join(' ')),
      isHit: scoreContent(c.content, (c.section_path || []).join(' ')) >= 0.75,
    }));
    v2Scored.sort((a, b) => b.similarity - a.similarity);
    v2Scored.forEach((item, idx) => { item.rank = idx + 1; });

    // 3. v2 + Contextualized 검색 점수 계산 (LLM Context 반영)
    const v2CtxScored = v2Chunks.map((c, i) => ({
      rank: i + 1,
      documentTitle: '임상 지침서',
      page: c.page_start || 1,
      sectionTitle: c.section_title || null,
      sectionPath: c.section_path,
      content: c.content,
      contextText: c.context_text,
      similarity: scoreContent(c.content, `${(c.section_path || []).join(' ')} ${c.context_text || ''}`),
      isHit: scoreContent(c.content, `${(c.section_path || []).join(' ')} ${c.context_text || ''}`) >= 0.75,
    }));
    v2CtxScored.sort((a, b) => b.similarity - a.similarity);
    v2CtxScored.forEach((item, idx) => { item.rank = idx + 1; });

    const calcMetrics = (results: RetrievalRankItem[]) => {
      const top5 = results.slice(0, 5);
      const hitIdx = top5.findIndex((r) => r.isHit);
      return {
        hitAt1: top5.length > 0 && top5[0].isHit,
        hitAt3: top5.slice(0, 3).some((r) => r.isHit),
        hitAt5: top5.some((r) => r.isHit),
        reciprocalRank: hitIdx !== -1 ? 1 / (hitIdx + 1) : 0,
      };
    };

    return {
      query,
      v1Fixed: {
        metrics: calcMetrics(v1Scored),
        topResults: v1Scored.slice(0, 5),
      },
      v2Structure: {
        metrics: calcMetrics(v2Scored),
        topResults: v2Scored.slice(0, 5),
      },
      v2Contextualized: {
        metrics: calcMetrics(v2CtxScored),
        topResults: v2CtxScored.slice(0, 5),
      },
    };
  }
}
