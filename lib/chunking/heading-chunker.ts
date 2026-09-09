import { ChunkStrategy, ChunkStrategyParams, GeneratedChunk } from './types';
import { cleanDocument } from '../rag/cleaning/clean-document';

export class HeadingAwareChunkStrategy implements ChunkStrategy {
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 1.7);
  }

  chunk(params: ChunkStrategyParams): GeneratedChunk[] {
    const { pages, documentId, ragProjectId, additionalMetadata = {}, options } = params;
    const { chunkSize, chunkOverlap } = options;

    const result: GeneratedChunk[] = [];
    let globalChunkIndex = 0;
    let currentSectionTitle: string | null = null;
    let currentHeadingLevel: number | null = null;

    // Heading 탐색 정규식: # 대제목/소제목 또는 "1. 머리말", "제1장", "## 5. 결어"
    const headingRegex = /^(#{1,4})\s+(.+)$|^(\d+\.\s+[가-힣a-zA-Z0-9\s]+)$|^(\[[가-힣a-zA-Z0-9\s]+\])$/;

    for (const page of pages) {
      const cleaned = cleanDocument(page.text).cleanedText;
      if (!cleaned) continue;

      // 1. 단락 단위 분할
      const paragraphs = cleaned.split(/\n\n+/);
      let currentSectionBlocks: string[] = [];

      for (const para of paragraphs) {
        const trimmed = para.trim();
        if (!trimmed) continue;

        const firstLine = trimmed.split('\n')[0].trim();
        const headingMatch = firstLine.match(headingRegex);

        // 새로운 Heading을 만났을 때
        if (headingMatch) {
          // 이전 섹션 블록들이 모여 있다면 먼저 청킹 처리
          if (currentSectionBlocks.length > 0) {
            const sectionText = currentSectionBlocks.join('\n\n');
            const subChunks = this.splitTextByTokens(sectionText, chunkSize, chunkOverlap);
            for (const content of subChunks) {
              result.push({
                document_id: documentId,
                rag_project_id: ragProjectId,
                chunk_index: globalChunkIndex++,
                content,
                token_count: this.estimateTokens(content),
                section_title: currentSectionTitle,
                metadata: {
                  ...additionalMetadata,
                  page: page.pageNumber,
                  char_length: content.length,
                  section_title: currentSectionTitle,
                  heading_level: currentHeadingLevel,
                  ingestion_version: 'rag-v2',
                },
              });
            }
            currentSectionBlocks = [];
          }

          // 현재 Heading 상태 갱신
          if (headingMatch[1]) {
            currentHeadingLevel = headingMatch[1].length;
            currentSectionTitle = headingMatch[2].trim();
          } else {
            currentHeadingLevel = 2;
            currentSectionTitle = firstLine.trim();
          }
        }

        currentSectionBlocks.push(trimmed);
      }

      // 페이지 끝 남아있는 섹션 블록 청킹 처리
      if (currentSectionBlocks.length > 0) {
        const sectionText = currentSectionBlocks.join('\n\n');
        const subChunks = this.splitTextByTokens(sectionText, chunkSize, chunkOverlap);
        for (const content of subChunks) {
          result.push({
            document_id: documentId,
            rag_project_id: ragProjectId,
            chunk_index: globalChunkIndex++,
            content,
            token_count: this.estimateTokens(content),
            section_title: currentSectionTitle,
            metadata: {
              ...additionalMetadata,
              page: page.pageNumber,
              char_length: content.length,
              section_title: currentSectionTitle,
              heading_level: currentHeadingLevel,
              ingestion_version: 'rag-v2',
            },
          });
        }
      }
    }

    return result;
  }

  /**
   * 문단/문장 경계를 존중하는 재귀적 슬라이딩 윈도우 분할
   */
  private splitTextByTokens(text: string, chunkSize: number, chunkOverlap: number): string[] {
    if (text.length <= chunkSize) {
      return [text];
    }

    const chunks: string[] = [];
    let startIndex = 0;

    while (startIndex < text.length) {
      let endIndex = startIndex + chunkSize;

      if (endIndex < text.length) {
        // 끝 120자 내에서 마침표, 물음표, 느낌표 또는 줄바꿈 경계 탐색
        const searchRange = text.substring(Math.max(startIndex, endIndex - 120), endIndex);
        const lastPunctuation = Math.max(
          searchRange.lastIndexOf('. '),
          searchRange.lastIndexOf('? '),
          searchRange.lastIndexOf('! '),
          searchRange.lastIndexOf('\n')
        );

        if (lastPunctuation !== -1) {
          endIndex = Math.max(startIndex, endIndex - 120) + lastPunctuation + 1;
        }
      }

      const chunkContent = text.substring(startIndex, endIndex).trim();
      if (chunkContent.length > 0) {
        chunks.push(chunkContent);
      }

      if (endIndex >= text.length) {
        break;
      }

      startIndex = Math.max(startIndex + 1, endIndex - chunkOverlap);
    }

    return chunks;
  }
}
