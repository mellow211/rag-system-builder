import { Contextualizer, DocumentContext, ContextualizedChunkResult } from './types';
import { IngestionChunk } from '../chunking/types';

export class NoOpContextualizer implements Contextualizer {
  readonly providerName = 'deterministic-structural';
  public static readonly PROMPT_VERSION = 'noop-v1';

  async contextualize(chunk: IngestionChunk, docContext: DocumentContext): Promise<ContextualizedChunkResult> {
    const secPath = chunk.section_path.length > 0 ? chunk.section_path.join(' > ') : (chunk.section_title || '일반 본문');
    const pageRange = chunk.page_start === chunk.page_end ? `p.${chunk.page_start}` : `p.${chunk.page_start}~p.${chunk.page_end}`;

    // 규칙 기반의 고품질 정적 구조 문맥 설명 (할루시네이션 0%)
    let typeDesc = '임상 및 건강 관리 내용';
    if (chunk.chunk_type === 'table') typeDesc = '상세 통계 및 기준 데이터 표(Table)';
    else if (chunk.chunk_type === 'list') typeDesc = '핵심 원칙 및 실행 항목 목록(List)';
    else if (chunk.chunk_type === 'qa') typeDesc = '진단 문진 및 질문-답변 항목(Q&A)';
    else if (chunk.chunk_type === 'definition') typeDesc = '용어 정의 및 개념 설명';

    const contextText = `이 내용은 '${docContext.documentTitle}'의 [${secPath}] 섹션(${pageRange})에 기술된 ${docContext.domain} 분야의 ${typeDesc}입니다.`;

    const contextualizedContent = `[문맥 요약]\n${contextText}\n\n[원문]\n${chunk.content}`;

    const embeddingContent = `[Document]\n${docContext.documentTitle}\n\n[Domain]\n${docContext.domain}\n\n[Section]\n${secPath}\n\n[Context]\n${contextText}\n\n[Content]\n${chunk.content}`;

    return {
      chunkIndex: chunk.chunk_index,
      contextText,
      contextModel: this.providerName,
      promptVersion: NoOpContextualizer.PROMPT_VERSION,
      generatedAt: new Date().toISOString(),
      fromCache: false,
      contextualizedContent,
      embeddingContent,
    };
  }

  async contextualizeBatch(
    chunks: IngestionChunk[],
    docContext: DocumentContext
  ): Promise<ContextualizedChunkResult[]> {
    return Promise.all(chunks.map((c) => this.contextualize(c, docContext)));
  }
}
