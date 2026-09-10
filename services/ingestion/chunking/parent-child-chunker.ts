import { ParsedPage } from '../../../lib/parsers/base';
import { BlockParser } from '../parsing/block-parser';
import { DocumentBlock } from '../parsing/types';
import { TokenCounter } from '../../../lib/chunking/token-counter';
import { StructureAwareChunker } from './structure-aware-chunker';
import { IngestionChunk, ChunkingResult, ChunkConfig } from './types';

export class ParentChildChunker {
  private childChunker: StructureAwareChunker;

  constructor(customConfig?: Partial<ChunkConfig>) {
    this.childChunker = new StructureAwareChunker(customConfig);
  }

  /**
   * 전체 페이지를 파싱하여 Section 단위의 Parent Chunk(1000~2500 tokens)와
   * 검색 단위의 Child Chunk(300~700 tokens)를 상호 연결하여 생성합니다.
   */
  public process(
    pages: ParsedPage[],
    documentId: string,
    ragProjectId: string,
    additionalMetadata: Record<string, unknown> = {}
  ): ChunkingResult {
    // 1. 페이지별 DocumentBlock 파싱
    const pagesWithBlocks = pages.map((page, idx) => {
      const pageNum = page.pageNumber ?? idx + 1;
      return {
        pageNumber: pageNum,
        blocks: BlockParser.parsePage(page.text, pageNum),
      };
    });

    // 2. 전체 블록 스트림 및 섹션 트리 구축
    const allBlocksWithMeta: Array<{
      block: DocumentBlock;
      sectionTitle: string | null;
      sectionPath: string[];
      pageNumber: number;
    }> = [];

    const sectionStack: Array<{ title: string; level: number }> = [];

    let totalBlocks = 0;
    let headingsCount = 0;
    let tablesCount = 0;
    let listsCount = 0;
    let qaCount = 0;

    for (const page of pagesWithBlocks) {
      for (const block of page.blocks) {
        totalBlocks++;
        if (block.type === 'heading') {
          headingsCount++;
          const level = block.level || 2;
          while (sectionStack.length > 0 && sectionStack[sectionStack.length - 1].level >= level) {
            sectionStack.pop();
          }
          sectionStack.push({ title: block.text, level });
        } else if (block.type === 'table') {
          tablesCount++;
        } else if (block.type === 'list') {
          listsCount++;
        } else if (block.type === 'qa') {
          qaCount++;
        }

        const currentSectionTitle = sectionStack.length > 0 ? sectionStack[sectionStack.length - 1].title : null;
        const currentSectionPath = sectionStack.map((s) => s.title);

        allBlocksWithMeta.push({
          block,
          sectionTitle: currentSectionTitle,
          sectionPath: [...currentSectionPath],
          pageNumber: page.pageNumber,
        });
      }
    }

    // 3. Child Chunks 생성 (검색 단위)
    const childChunks = this.childChunker.chunkBlocks(
      allBlocksWithMeta,
      documentId,
      ragProjectId,
      additionalMetadata
    );

    // 4. Parent Chunks 생성 (Section 단위: 1000~2500 토큰)
    const parentChunks: IngestionChunk[] = [];
    const sectionGroups = new Map<string, IngestionChunk[]>();

    for (const child of childChunks) {
      const secKey = child.section_title || 'ROOT_SECTION';
      if (!sectionGroups.has(secKey)) {
        sectionGroups.set(secKey, []);
      }
      sectionGroups.get(secKey)!.push(child);
    }

    let parentIndex = 0;
    for (const [secTitle, children] of sectionGroups.entries()) {
      let parentBuffer: IngestionChunk[] = [];
      let parentTokens = 0;

      const flushParent = () => {
        if (parentBuffer.length === 0) return;

        const parentId = `parent_${documentId.slice(0, 8)}_${parentIndex}`;
        const pStart = parentBuffer[0].page_start;
        const pEnd = parentBuffer[parentBuffer.length - 1].page_end;
        const parentContent = parentBuffer.map((c) => c.content).join('\n\n---\n\n');
        const pTokens = TokenCounter.count(parentContent);

        const parentChunk: IngestionChunk = {
          id: parentId,
          document_id: documentId,
          rag_project_id: ragProjectId,
          chunk_index: parentIndex++,
          chunk_type: 'parent',
          content: parentContent,
          embedding_content: `[Section Context: ${secTitle}]\n${parentContent}`,
          token_count: pTokens,
          page_start: pStart,
          page_end: pEnd,
          section_title: secTitle === 'ROOT_SECTION' ? null : secTitle,
          section_path: parentBuffer[0].section_path,
          chunking_version: 'v2',
          metadata: {
            ...additionalMetadata,
            page: pStart,
            page_start: pStart,
            page_end: pEnd,
            section_title: secTitle === 'ROOT_SECTION' ? null : secTitle,
            section_path: parentBuffer[0].section_path,
            chunk_type: 'parent',
            token_count: pTokens,
            char_length: parentContent.length,
            child_chunk_indices: parentBuffer.map((c) => c.chunk_index),
            chunking_version: 'v2',
            domain: (additionalMetadata.domain as string) || 'health',
            document_title: (additionalMetadata.title as string) || '문서',
            document_id: documentId,
          },
        };

        parentChunks.push(parentChunk);

        // 자식 청크들에게 parent_chunk_id 연결
        for (const child of parentBuffer) {
          child.parent_chunk_id = parentId;
          child.metadata.parent_chunk_id = parentId;
        }

        parentBuffer = [];
        parentTokens = 0;
      };

      for (const child of children) {
        if (parentTokens + child.token_count > 2500 && parentTokens >= 1000) {
          flushParent();
        }
        parentBuffer.push(child);
        parentTokens += child.token_count;
      }

      if (parentBuffer.length > 0) {
        flushParent();
      }
    }

    // 통계 계산
    const childTokens = childChunks.map((c) => c.token_count);
    const avgTokens = childTokens.length > 0 ? Math.round(childTokens.reduce((a, b) => a + b, 0) / childTokens.length) : 0;
    const minTokens = childTokens.length > 0 ? Math.min(...childTokens) : 0;
    const maxTokens = childTokens.length > 0 ? Math.max(...childTokens) : 0;

    // 문장 중간 잘림 추정 (완전한 종결 부호 [.?!] 로 끝나지 않는 청크 검출)
    let midSentenceCutCount = 0;
    for (const child of childChunks) {
      const trimmed = child.content.trim();
      if (!/[.!?]$/.test(trimmed) && child.chunk_type !== 'table') {
        midSentenceCutCount++;
      }
    }

    return {
      parentChunks,
      childChunks,
      allChunks: [...parentChunks, ...childChunks],
      stats: {
        totalBlocks,
        headingsCount,
        tablesCount,
        listsCount,
        qaCount,
        parentChunksCount: parentChunks.length,
        childChunksCount: childChunks.length,
        avgTokensPerChunk: avgTokens,
        minTokens,
        maxTokens,
        midSentenceCutCount,
      },
    };
  }
}
