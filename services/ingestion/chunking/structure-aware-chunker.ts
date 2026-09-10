import { DocumentBlock, BlockType } from '../parsing/types';
import { TokenCounter } from '../../../lib/chunking/token-counter';
import { KoreanSentenceSplitter, defaultSentenceSplitter } from '../parsing/sentence-splitter';
import { ChunkConfig, IngestionChunk, ChunkingResult } from './types';
import { getDomainChunkingPolicy } from './domain-policies';

export class StructureAwareChunker {
  private config: ChunkConfig;
  private sentenceSplitter: KoreanSentenceSplitter;

  constructor(customConfig?: Partial<ChunkConfig>) {
    this.config = {
      targetTokens: customConfig?.targetTokens ?? 500,
      maxTokens: customConfig?.maxTokens ?? 750,
      minTokens: customConfig?.minTokens ?? 150,
      overlapTokens: customConfig?.overlapTokens ?? 50,
      hardMaxTokens: customConfig?.hardMaxTokens ?? 1000,
    };
    this.sentenceSplitter = defaultSentenceSplitter;
  }

  /**
   * 블록 스트림과 섹션 트리를 토큰 기반으로 지능적 패킹하여 Child Chunk 목록을 생성합니다.
   */
  public chunkBlocks(
    blocksWithMeta: Array<{
      block: DocumentBlock;
      sectionTitle: string | null;
      sectionPath: string[];
      pageNumber: number;
    }>,
    documentId: string,
    ragProjectId: string,
    additionalMetadata: Record<string, unknown> = {}
  ): IngestionChunk[] {
    const domain = (additionalMetadata.domain as string) || 'health';
    const domainPolicy = getDomainChunkingPolicy(domain);
    const documentTitle = (additionalMetadata.title as string) || (additionalMetadata.filename as string) || '문서';

    const chunks: IngestionChunk[] = [];
    let currentBlocks: typeof blocksWithMeta = [];
    let currentTokens = 0;
    let globalIndex = 0;
    let overlapSentences: string[] = []; // 이전 청크의 문장 단위 오버랩

    const flushChunk = (forcedType?: BlockType | 'paragraph') => {
      if (currentBlocks.length === 0) return;

      const firstItem = currentBlocks[0];
      const lastItem = currentBlocks[currentBlocks.length - 1];
      const pageStart = firstItem.pageNumber;
      const pageEnd = lastItem.pageNumber;

      // 본문 텍스트 조합 (순수 원문)
      let content = currentBlocks.map((b) => b.block.text).join('\n\n').trim();

      // 이전 청크 오버랩 문장이 있다면 청크 시작부에 자연스럽게 연결
      if (overlapSentences.length > 0 && !content.startsWith(overlapSentences[0])) {
        const overlapText = overlapSentences.join(' ');
        // 이미 포함되어 있지 않은 경우에만 오버랩 결합
        if (!content.includes(overlapText)) {
          content = `${overlapText}\n\n${content}`;
        }
      }

      const tokenCount = TokenCounter.count(content);

      // 청크 타입 결정 (table, list, qa, definition 우선 반영)
      let chunkType: BlockType = forcedType || 'paragraph';
      if (!forcedType) {
        const types = currentBlocks.map((b) => b.block.type);
        if (types.includes('table')) chunkType = 'table';
        else if (types.includes('qa')) chunkType = 'qa';
        else if (types.includes('list')) chunkType = 'list';
        else if (types.includes('definition')) chunkType = 'definition';
        else chunkType = 'paragraph';
      }

      // 기본 임시 embedding_content (PHASE 5/6에서 Contextualization과 결합됨)
      const pathStr = firstItem.sectionPath.length > 0 ? firstItem.sectionPath.join(' > ') : (firstItem.sectionTitle || '일반');
      const pageStr = pageStart === pageEnd ? `p.${pageStart}` : `p.${pageStart}~p.${pageEnd}`;
      const defaultEmbeddingContent = `[Document]\n${documentTitle}\n\n[Domain]\n${domain}\n\n[Section]\n${pathStr}\n\n[Content]\n${content}`;

      const chunk: IngestionChunk = {
        document_id: documentId,
        rag_project_id: ragProjectId,
        chunk_index: globalIndex++,
        chunk_type: chunkType,
        content,
        embedding_content: defaultEmbeddingContent,
        token_count: tokenCount,
        page_start: pageStart,
        page_end: pageEnd,
        section_title: firstItem.sectionTitle,
        section_path: firstItem.sectionPath,
        chunking_version: 'v2',
        metadata: {
          ...additionalMetadata,
          page: pageStart,
          page_start: pageStart,
          page_end: pageEnd,
          section_title: firstItem.sectionTitle,
          section_path: firstItem.sectionPath,
          chunk_type: chunkType,
          token_count: tokenCount,
          char_length: content.length,
          domain,
          document_title: documentTitle,
          document_id: documentId,
          chunking_version: 'v2',
          embedding_content: defaultEmbeddingContent,
        },
      };

      chunks.push(chunk);

      // 다음 청크를 위한 문장 단위 Overlap 추출 (마지막 1~2문장, 약 50 토큰 내외)
      const sentences = this.sentenceSplitter.split(content);
      if (sentences.length >= 2) {
        const lastSentence = sentences[sentences.length - 1];
        if (TokenCounter.count(lastSentence) <= this.config.overlapTokens + 30) {
          overlapSentences = [lastSentence];
        } else {
          overlapSentences = [];
        }
      } else {
        overlapSentences = [];
      }

      currentBlocks = [];
      currentTokens = 0;
    };

    for (let i = 0; i < blocksWithMeta.length; i++) {
      const item = blocksWithMeta[i];
      const block = item.block;
      const blockTokens = TokenCounter.count(block.text);

      // 1. 헤딩인 경우: 제목 자체만 고립시키지 않고 바로 다음 문단과 결합 시도
      if (block.type === 'heading') {
        // 이미 쌓인 블록이 최소 임계치 이상이면 먼저 방출
        if (currentTokens >= this.config.minTokens) {
          flushChunk();
        }

        // 헤딩 + 바로 뒤 첫 본문 문단을 묶기 위해 임시 버퍼에 적재
        currentBlocks.push(item);
        currentTokens += blockTokens;
        continue;
      }

      // 2. 표(Table) 또는 Q&A/문진(QA) 블록: 의미 단위 절대 보호
      if (block.type === 'table' || block.type === 'qa') {
        if (currentTokens > 0) {
          flushChunk();
        }
        currentBlocks.push(item);
        currentTokens = blockTokens;
        flushChunk(block.type);
        continue;
      }

      // 3. 목록(List) 블록: 가능한 분할하지 않고 하나의 청크로 보존
      if (block.type === 'list') {
        if (currentTokens + blockTokens > this.config.maxTokens && currentTokens > 0) {
          flushChunk();
        }
        currentBlocks.push(item);
        currentTokens += blockTokens;

        if (currentTokens >= this.config.targetTokens) {
          flushChunk('list');
        }
        continue;
      }

      // 4. 일반 본문 단락(Paragraph)
      // (A) 단락 하나가 MAX_CHUNK_TOKENS를 초과하는 경우 -> 한국어 문장 분리 수행
      if (blockTokens > this.config.maxTokens) {
        if (currentTokens > 0) {
          flushChunk();
        }

        const sentences = this.sentenceSplitter.split(block.text);
        let sentenceBuffer: string[] = [];
        let sentenceTokens = 0;

        for (const sentence of sentences) {
          const sTokens = TokenCounter.count(sentence);
          if (sentenceTokens + sTokens > this.config.targetTokens && sentenceTokens >= this.config.minTokens) {
            currentBlocks.push({
              ...item,
              block: { ...block, text: sentenceBuffer.join(' ') },
            });
            flushChunk();
            sentenceBuffer = [];
            sentenceTokens = 0;
          }

          sentenceBuffer.push(sentence);
          sentenceTokens += sTokens;
        }

        if (sentenceBuffer.length > 0) {
          currentBlocks.push({
            ...item,
            block: { ...block, text: sentenceBuffer.join(' ') },
          });
          currentTokens = sentenceTokens;
        }
        continue;
      }

      // (B) 일반 크기 단락: 목표 토큰에 도달할 때까지 누적
      if (currentTokens + blockTokens > this.config.maxTokens) {
        // 도메인 정책상 약간의 초과(HARD_MAX 이내)가 의미 보존에 낫다면 묶어서 방출
        if (
          domainPolicy.allowOversizeForSemanticUnit &&
          currentTokens + blockTokens <= this.config.hardMaxTokens
        ) {
          currentBlocks.push(item);
          currentTokens += blockTokens;
          flushChunk();
          continue;
        }

        flushChunk();
      }

      currentBlocks.push(item);
      currentTokens += blockTokens;

      if (currentTokens >= this.config.targetTokens) {
        flushChunk();
      }
    }

    // 잔여 블록 방출
    if (currentBlocks.length > 0) {
      flushChunk();
    }

    return chunks;
  }
}
