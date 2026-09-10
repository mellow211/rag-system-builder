import { Contextualizer, DocumentContext, ContextualizedChunkResult } from './types';
import { IngestionChunk } from '../chunking/types';
import { ContextCache } from './context-cache';
import { NoOpContextualizer } from './no-op-contextualizer';

export class LLMContextualizer implements Contextualizer {
  readonly providerName: string;
  private apiKey: string;
  private modelName: string;
  private fallbackContextualizer: NoOpContextualizer;
  public static readonly PROMPT_VERSION = 'llm-ctx-v1';

  constructor(apiKey?: string, modelName?: string, providerName?: string) {
    this.apiKey = apiKey || process.env.CONTEXT_LLM_API_KEY || process.env.OPENAI_API_KEY || '';
    this.modelName = modelName || process.env.CONTEXT_LLM_MODEL || 'gpt-4o-mini';
    this.providerName = providerName || process.env.CONTEXT_LLM_PROVIDER || 'openai';
    this.fallbackContextualizer = new NoOpContextualizer();
  }

  /**
   * 단일 청크에 대해 LLM 문맥 요약을 생성합니다.
   * 캐시 확인 ➡️ LLM 호출 ➡️ 실패 시 NoOpContextualizer로 안전 폴백
   */
  async contextualize(chunk: IngestionChunk, docContext: DocumentContext): Promise<ContextualizedChunkResult> {
    const secPath = chunk.section_path.length > 0 ? chunk.section_path.join(' > ') : (chunk.section_title || '일반');
    const hash = ContextCache.computeHash(
      chunk.document_id,
      chunk.section_path,
      chunk.content,
      LLMContextualizer.PROMPT_VERSION
    );

    // 1. 캐시 확인
    const cached = await ContextCache.get(hash);
    if (cached) {
      const embeddingContent = `[Document]\n${docContext.documentTitle}\n\n[Domain]\n${docContext.domain}\n\n[Section]\n${secPath}\n\n[Context]\n${cached}\n\n[Content]\n${chunk.content}`;
      return {
        chunkIndex: chunk.chunk_index,
        contextText: cached,
        contextModel: `${this.modelName} (cache)`,
        promptVersion: LLMContextualizer.PROMPT_VERSION,
        generatedAt: new Date().toISOString(),
        fromCache: true,
        contextualizedContent: `[문맥 요약]\n${cached}\n\n[원문]\n${chunk.content}`,
        embeddingContent,
      };
    }

    // 2. API 키 부재 시 즉시 NoOp 폴백
    if (!this.apiKey) {
      return this.fallbackContextualizer.contextualize(chunk, docContext);
    }

    // 3. LLM 호출
    try {
      const contextText = await this.callLLM(chunk, docContext, secPath);

      // 캐시에 저장
      await ContextCache.set(
        hash,
        chunk.document_id,
        contextText,
        this.modelName,
        LLMContextualizer.PROMPT_VERSION
      );

      const embeddingContent = `[Document]\n${docContext.documentTitle}\n\n[Domain]\n${docContext.domain}\n\n[Section]\n${secPath}\n\n[Context]\n${contextText}\n\n[Content]\n${chunk.content}`;

      return {
        chunkIndex: chunk.chunk_index,
        contextText,
        contextModel: this.modelName,
        promptVersion: LLMContextualizer.PROMPT_VERSION,
        generatedAt: new Date().toISOString(),
        fromCache: false,
        contextualizedContent: `[문맥 요약]\n${contextText}\n\n[원문]\n${chunk.content}`,
        embeddingContent,
      };
    } catch (err) {
      console.warn(`[LLMContextualizer] Chunk #${chunk.chunk_index} 문맥 생성 실패, NoOp 폴백:`, err);
      return this.fallbackContextualizer.contextualize(chunk, docContext);
    }
  }

  /**
   * 배치 청크 처리 (동시 요청 수 제한으로 Rate-limit 방어)
   */
  async contextualizeBatch(
    chunks: IngestionChunk[],
    docContext: DocumentContext
  ): Promise<ContextualizedChunkResult[]> {
    const results: ContextualizedChunkResult[] = [];
    const batchSize = 4; // 동시 4개 청크씩 순차 처리

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map((c) => this.contextualize(c, docContext)));
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * OpenAI API 호출 (엄격한 Prompt 가이드라인 적용)
   */
  private async callLLM(chunk: IngestionChunk, docContext: DocumentContext, secPath: string): Promise<string> {
    const systemPrompt = `너는 고령자 보건의료 및 의학 RAG 시스템의 검색 문맥 생성기이다.
제공된 청크가 전체 문서에서 어떤 내용을 설명하는지 검색 품질을 높이기 위한 문맥을 1~3문장(약 30~80 토큰)으로 짧게 생성하라.

[엄격한 금지 규칙]
1. 원문에 없는 새로운 의학적 사실, 진단, 치료 권고를 절대 생성하지 마라.
2. 숫자를 임의로 생성하거나 변경하지 마라.
3. 오직 이 청크가 어느 주제, 대상, 상황에 관한 내용인지 검색용 문맥만 간결하게 기술하라.
4. "이 청크는", "이 문서는" 등으로 시작하지 말고 직접적이고 자연스러운 한국어 평서문으로 작성하라.`;

    const userPrompt = `[문서 제목]: ${docContext.documentTitle}
[도메인/분야]: ${docContext.domain}
[현재 섹션]: ${secPath}
[청크 타입]: ${chunk.chunk_type}

[청크 본문]:
${chunk.content.slice(0, 800)}

위 본문이 전체 문서의 흐름에서 무엇을 다루는지 검색용 문맥을 1~2문장으로 설명하라:`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 120,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API 오류 (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const generated = data.choices?.[0]?.message?.content?.trim();
    if (!generated) {
      throw new Error('LLM 응답이 비어 있습니다.');
    }

    return generated;
  }
}
