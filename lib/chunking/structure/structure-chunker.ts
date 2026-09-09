import { ParsedPage } from '../../parsers/base';
import {
  DocumentBlock,
  ParsedPageWithBlocks,
  StructureGeneratedChunk,
  StructureChunkResult,
} from './types';
import { BlockParser } from './block-parser';
import { TokenCounter } from '../token-counter';
import { SentenceSplitter } from './sentence-splitter';
import { RAG_CONFIG } from '../../rag/config';

export interface StructureChunkerOptions {
  targetTokens?: number;
  maxTokens?: number;
  minTokens?: number;
  overlapRatio?: number;
  parentChunkTokens?: number;
}

export class StructureChunker {
  private targetTokens: number;
  private maxTokens: number;
  private minTokens: number;
  private overlapRatio: number;
  private parentChunkTokens: number;

  constructor(options?: StructureChunkerOptions) {
    this.targetTokens = options?.targetTokens ?? 550;
    this.maxTokens = options?.maxTokens ?? 800;
    this.minTokens = options?.minTokens ?? 150;
    this.overlapRatio = options?.overlapRatio ?? 0.1;
    this.parentChunkTokens = options?.parentChunkTokens ?? 1800;
  }

  /**
   * 전체 페이지 목록을 수신하여 구조 분석 기반 Parent/Child 청크를 생성합니다.
   */
  public chunkDocument(
    pages: ParsedPage[],
    documentId: string,
    ragProjectId: string,
    additionalMetadata: Record<string, unknown> = {}
  ): StructureChunkResult {
    // 1. 모든 페이지를 DocumentBlock 단위로 파싱
    const pagesWithBlocks: ParsedPageWithBlocks[] = pages.map((page, pIdx) => {
      const pageNum = page.pageNumber ?? (pIdx + 1);
      return {
        ...page,
        pageNumber: pageNum,
        blocks: BlockParser.parsePage(page.text, pageNum),
      };
    });

    // 2. 전체 블록 스트림 및 섹션 계층 트리 구축
    const allBlocksWithMeta: Array<{
      block: DocumentBlock;
      sectionTitle: string | null;
      sectionPath: string[];
      pageNumber: number;
    }> = [];

    const sectionStack: Array<{ title: string; level: number }> = [];

    for (const page of pagesWithBlocks) {
      const pageNum = page.pageNumber ?? 1;
      for (const block of page.blocks) {
        if (block.type === 'heading') {
          const level = block.level || 2;
          // 스택에서 현재 레벨 이상의 상위/동일 레벨 제거
          while (sectionStack.length > 0 && sectionStack[sectionStack.length - 1].level >= level) {
            sectionStack.pop();
          }
          sectionStack.push({ title: block.text, level });
        }

        const currentSectionTitle = sectionStack.length > 0 ? sectionStack[sectionStack.length - 1].title : null;
        const currentSectionPath = sectionStack.map((s) => s.title);

        allBlocksWithMeta.push({
          block,
          sectionTitle: currentSectionTitle,
          sectionPath: [...currentSectionPath],
          pageNumber: pageNum,
        });
      }
    }

    // 3. Child Chunk 생성 (Token 기반 스마트 패킹)
    const childChunks: StructureGeneratedChunk[] = [];
    let currentChunkBlocks: typeof allBlocksWithMeta = [];
    let currentChunkTokens = 0;
    let globalChildIndex = 0;

    const documentTitle = (additionalMetadata.title as string) || (additionalMetadata.filename as string) || '문서';
    const domainName = (additionalMetadata.domain as string) || '건강정보';

    const flushChildChunk = (forcedType?: StructureGeneratedChunk['chunk_type']) => {
      if (currentChunkBlocks.length === 0) return;

      const firstBlock = currentChunkBlocks[0];
      const lastBlock = currentChunkBlocks[currentChunkBlocks.length - 1];
      const pageStart = firstBlock.pageNumber;
      const pageEnd = lastBlock.pageNumber;

      // 본문 텍스트 결합 (순수 원문)
      const content = currentChunkBlocks.map((b) => b.block.text).join('\n\n').trim();
      const tokenCount = TokenCounter.count(content);

      // 청크 타입 결정 (table, list, qa 또는 paragraph)
      let chunkType: StructureGeneratedChunk['chunk_type'] = forcedType || 'paragraph';
      if (!forcedType) {
        const types = currentChunkBlocks.map((b) => b.block.type);
        if (types.includes('table')) chunkType = 'table';
        else if (types.includes('list')) chunkType = 'list';
        else if (types.includes('qa')) chunkType = 'qa';
        else chunkType = 'paragraph';
      }

      // Context-enriched Embedding Content 포맷 구성
      const pathStr = firstBlock.sectionPath.length > 0 ? firstBlock.sectionPath.join(' > ') : (firstBlock.sectionTitle || '일반');
      const pageStr = pageStart === pageEnd ? `p.${pageStart}` : `p.${pageStart}~p.${pageEnd}`;

      const embeddingContent = `문서: ${documentTitle}\n분야: ${domainName}\n섹션: ${pathStr}\n페이지: ${pageStr}\n\n[본문]\n${content}`;

      const chunk: StructureGeneratedChunk = {
        document_id: documentId,
        rag_project_id: ragProjectId,
        chunk_index: globalChildIndex++,
        chunk_type: chunkType,
        content,
        embedding_content: embeddingContent,
        token_count: tokenCount,
        page_start: pageStart,
        page_end: pageEnd,
        section_title: firstBlock.sectionTitle,
        section_path: firstBlock.sectionPath,
        chunking_version: 'v2',
        metadata: {
          ...additionalMetadata,
          page: pageStart,
          page_start: pageStart,
          page_end: pageEnd,
          section_title: firstBlock.sectionTitle,
          section_path: firstBlock.sectionPath,
          chunk_type: chunkType,
          token_count: tokenCount,
          char_length: content.length,
          embedding_content: embeddingContent,
          chunking_version: 'v2',
        },
      };

      childChunks.push(chunk);
      currentChunkBlocks = [];
      currentChunkTokens = 0;
    };

    for (let i = 0; i < allBlocksWithMeta.length; i++) {
      const item = allBlocksWithMeta[i];
      const block = item.block;
      const blockTokens = TokenCounter.count(block.text);

      // (1) 단독 블록이 MAX_CHUNK_TOKENS를 초과하는 긴 문단인 경우 -> 문장 단위로 분할
      if (blockTokens > this.maxTokens && block.type !== 'table') {
        flushChildChunk();

        const sentences = SentenceSplitter.split(block.text);
        let sentenceBuffer: string[] = [];
        let sentenceTokens = 0;

        for (let sIdx = 0; sIdx < sentences.length; sIdx++) {
          const sent = sentences[sIdx];
          const sTokens = TokenCounter.count(sent);

          if (sentenceTokens + sTokens > this.targetTokens && sentenceBuffer.length > 0) {
            // 현재 문장 버퍼로 청크 생성
            const subContent = sentenceBuffer.join(' ');
            const subTokenCount = TokenCounter.count(subContent);
            const pathStr = item.sectionPath.length > 0 ? item.sectionPath.join(' > ') : (item.sectionTitle || '일반');

            const embeddingContent = `문서: ${documentTitle}\n분야: ${domainName}\n섹션: ${pathStr}\n페이지: p.${item.pageNumber}\n\n[본문]\n${subContent}`;

            childChunks.push({
              document_id: documentId,
              rag_project_id: ragProjectId,
              chunk_index: globalChildIndex++,
              chunk_type: 'paragraph',
              content: subContent,
              embedding_content: embeddingContent,
              token_count: subTokenCount,
              page_start: item.pageNumber,
              page_end: item.pageNumber,
              section_title: item.sectionTitle,
              section_path: item.sectionPath,
              chunking_version: 'v2',
              metadata: {
                ...additionalMetadata,
                page: item.pageNumber,
                page_start: item.pageNumber,
                page_end: item.pageNumber,
                section_title: item.sectionTitle,
                section_path: item.sectionPath,
                chunk_type: 'paragraph',
                token_count: subTokenCount,
                char_length: subContent.length,
                embedding_content: embeddingContent,
                chunking_version: 'v2',
              },
            });

            // 10% Overlap 문장 유지 (마지막 1~2문장 유지)
            const overlapTokensTarget = Math.max(20, Math.floor(this.targetTokens * this.overlapRatio));
            let overlapTokens = 0;
            const overlapSentences: string[] = [];
            for (let rev = sentenceBuffer.length - 1; rev >= 0; rev--) {
              overlapSentences.unshift(sentenceBuffer[rev]);
              overlapTokens += TokenCounter.count(sentenceBuffer[rev]);
              if (overlapTokens >= overlapTokensTarget) break;
            }

            sentenceBuffer = [...overlapSentences];
            sentenceTokens = overlapTokens;
          }

          sentenceBuffer.push(sent);
          sentenceTokens += sTokens;
        }

        if (sentenceBuffer.length > 0) {
          const subContent = sentenceBuffer.join(' ');
          const subTokenCount = TokenCounter.count(subContent);
          const pathStr = item.sectionPath.length > 0 ? item.sectionPath.join(' > ') : (item.sectionTitle || '일반');
          const embeddingContent = `문서: ${documentTitle}\n분야: ${domainName}\n섹션: ${pathStr}\n페이지: p.${item.pageNumber}\n\n[본문]\n${subContent}`;

          childChunks.push({
            document_id: documentId,
            rag_project_id: ragProjectId,
            chunk_index: globalChildIndex++,
            chunk_type: 'paragraph',
            content: subContent,
            embedding_content: embeddingContent,
            token_count: subTokenCount,
            page_start: item.pageNumber,
            page_end: item.pageNumber,
            section_title: item.sectionTitle,
            section_path: item.sectionPath,
            chunking_version: 'v2',
            metadata: {
              ...additionalMetadata,
              page: item.pageNumber,
              page_start: item.pageNumber,
              page_end: item.pageNumber,
              section_title: item.sectionTitle,
              section_path: item.sectionPath,
              chunk_type: 'paragraph',
              token_count: subTokenCount,
              char_length: subContent.length,
              embedding_content: embeddingContent,
              chunking_version: 'v2',
            },
          });
        }
        continue;
      }

      // (2) 표(Table), 리스트(List), QA 블록의 의미 단위 보존
      if (block.type === 'table' || block.type === 'qa') {
        flushChildChunk();
        currentChunkBlocks.push(item);
        currentChunkTokens += blockTokens;
        // 단독 청크로 마감
        flushChildChunk(block.type);
        continue;
      }

      // (3) 제목(Heading)을 만난 경우
      if (block.type === 'heading') {
        // 이미 모인 블록이 있고 MIN_CHUNK_TOKENS 이상이면 이전 섹션 마감
        if (currentChunkTokens >= this.minTokens) {
          flushChildChunk();
        }
        currentChunkBlocks.push(item);
        currentChunkTokens += blockTokens;
        continue;
      }

      // (4) 일반 블록 누적 패킹
      if (currentChunkTokens + blockTokens > this.targetTokens && currentChunkTokens >= this.minTokens) {
        flushChildChunk();
      }

      currentChunkBlocks.push(item);
      currentChunkTokens += blockTokens;

      // 만약 MAX_CHUNK_TOKENS에 도달하면 즉시 마감
      if (currentChunkTokens >= this.maxTokens) {
        flushChildChunk();
      }
    }

    // 남아있는 블록 마감
    flushChildChunk();

    // 4. Parent Chunk 생성 (섹션 또는 큰 주제 단위 그룹핑: 1500~2000 tokens)
    const parentChunks: StructureGeneratedChunk[] = [];
    const sectionGroups = new Map<string, StructureGeneratedChunk[]>();

    for (const child of childChunks) {
      const secKey = child.section_path.length > 0 ? child.section_path[0] : (child.section_title || 'main');
      const list = sectionGroups.get(secKey) || [];
      list.push(child);
      sectionGroups.set(secKey, list);
    }

    let globalParentIndex = 0;

    for (const [secTitle, groupChildChunks] of sectionGroups.entries()) {
      // 1500~2000 토큰 단위로 Parent Chunk 구성
      let parentBuffer: StructureGeneratedChunk[] = [];
      let parentTokens = 0;

      const flushParentChunk = () => {
        if (parentBuffer.length === 0) return;

        const parentId = `parent-${documentId.slice(0, 8)}-${globalParentIndex}`;
        const parentContent = parentBuffer.map((c) => c.content).join('\n\n');
        const pTokens = TokenCounter.count(parentContent);
        const pStart = parentBuffer[0].page_start;
        const pEnd = parentBuffer[parentBuffer.length - 1].page_end;

        const parentChunk: StructureGeneratedChunk = {
          id: parentId,
          document_id: documentId,
          rag_project_id: ragProjectId,
          chunk_index: globalParentIndex++,
          chunk_type: 'parent',
          content: parentContent,
          embedding_content: `[섹션 컨텍스트 요약: ${secTitle}]\n${parentContent}`,
          token_count: pTokens,
          page_start: pStart,
          page_end: pEnd,
          section_title: secTitle,
          section_path: [secTitle],
          chunking_version: 'v2',
          metadata: {
            ...additionalMetadata,
            page: pStart,
            page_start: pStart,
            page_end: pEnd,
            section_title: secTitle,
            section_path: [secTitle],
            chunk_type: 'parent',
            token_count: pTokens,
            char_length: parentContent.length,
            embedding_content: `[섹션 컨텍스트 요약: ${secTitle}]\n${parentContent}`,
            child_chunk_indices: parentBuffer.map((c) => c.chunk_index),
            chunking_version: 'v2',
          },
        };

        parentChunks.push(parentChunk);

        // 해당 자식 청크들에 parent_chunk_id 연결
        for (const child of parentBuffer) {
          child.parent_chunk_id = parentId;
          child.metadata.parent_chunk_id = parentId;
        }

        parentBuffer = [];
        parentTokens = 0;
      };

      for (const child of groupChildChunks) {
        if (parentTokens + child.token_count > this.parentChunkTokens && parentBuffer.length > 0) {
          flushParentChunk();
        }
        parentBuffer.push(child);
        parentTokens += child.token_count;
      }

      flushParentChunk();
    }

    const allChunks = [...childChunks];
    const totalTokens = childChunks.reduce((acc, c) => acc + c.token_count, 0);

    const stats = {
      totalBlocks: allBlocksWithMeta.length,
      headingsCount: allBlocksWithMeta.filter((b) => b.block.type === 'heading').length,
      tablesCount: allBlocksWithMeta.filter((b) => b.block.type === 'table').length,
      listsCount: allBlocksWithMeta.filter((b) => b.block.type === 'list').length,
      qaCount: allBlocksWithMeta.filter((b) => b.block.type === 'qa').length,
      parentChunksCount: parentChunks.length,
      childChunksCount: childChunks.length,
      avgTokensPerChunk: childChunks.length > 0 ? Math.round(totalTokens / childChunks.length) : 0,
    };

    return {
      parentChunks,
      childChunks,
      allChunks,
      stats,
    };
  }
}
