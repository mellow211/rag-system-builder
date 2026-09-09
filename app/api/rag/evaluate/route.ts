import { NextRequest, NextResponse } from 'next/server';
import { ragEvaluator } from '@/services/evaluation/evaluator';
import { SearchPipelineMode } from '@/services/retrieval/advanced-search';
import { DomainType } from '@/types/rag';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { domain, mode = 'advanced-v2', topK = 5 } = body;

    const result = await ragEvaluator.runEvaluation({
      domain: domain as DomainType,
      mode: mode as SearchPipelineMode,
      topK: topK ? parseInt(topK, 10) : 5,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('RAG Evaluation error:', err);
    const message = err instanceof Error ? err.message : '평가 실행 중 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
