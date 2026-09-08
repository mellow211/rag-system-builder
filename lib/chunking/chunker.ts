import { ParsedPage } from '../parsers/base';
import { TextCleaner } from './text-cleaner';

export interface ChunkingOptions {
  chunkSize?: number;       // 기본 약 800자
  chunkOverlap?: number;    // 기본 약 150자
  separators?: string[];    // 단락/문장 구분자 우선순위
}

export interface GeneratedChunk {
  document_id: string;
  rag_project_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  metadata: {
    page?: number;
    char_length: number;
    [key: string]: unknown;
  };
}

export class DocumentChunker {
  private chunkSize: number;
  private chunkOverlap: number;

  constructor(options?: ChunkingOptions) {
    this.chunkSize = options?.chunkSize ?? 800;
    this.chunkOverlap = options?.chunkOverlap ?? 150;

    if (this.chunkOverlap >= this.chunkSize) {
      throw new Error('chunkOverlap은 chunkSize보다 작아야 합니다.');
    }
  }

  /**
   * 한국어/영어 대략적인 토큰 수 추정치 계산
   */
  private estimateTokenCount(text: string): number {
    // 한국어 기준 통상 1.5~2자당 1토큰 내외
    return Math.ceil(text.length / 1.7);
  }

  /**
   * 단일 텍스트 블록을 슬라이딩 윈도우 방식으로 청킹
   */
  private chunkText(text: string): string[] {
    const cleaned = TextCleaner.clean(text);
    if (!cleaned) return [];

    if (cleaned.length <= this.chunkSize) {
      return [cleaned];
    }

    const chunks: string[] = [];
    let startIndex = 0;

    while (startIndex < cleaned.length) {
      let endIndex = startIndex + this.chunkSize;

      // 끝 지점이 전체 길이 미만일 경우, 문장이나 단락 경계에서 자연스럽게 자르기
      if (endIndex < cleaned.length) {
        // 구분자 탐색 범위 (끝에서 100자 이내에서 마침표나 줄바꿈 탐색)
        const searchRange = cleaned.substring(Math.max(startIndex, endIndex - 120), endIndex);
        const lastPeriod = searchRange.lastIndexOf('. ');
        const lastNewline = searchRange.lastIndexOf('\n');

        let boundaryOffset = -1;
        if (lastNewline !== -1) {
          boundaryOffset = lastNewline + 1;
        } else if (lastPeriod !== -1) {
          boundaryOffset = lastPeriod + 2;
        }

        if (boundaryOffset !== -1) {
          endIndex = Math.max(startIndex, endIndex - 120) + boundaryOffset;
        }
      }

      const chunkContent = cleaned.substring(startIndex, endIndex).trim();
      if (chunkContent.length > 0) {
        chunks.push(chunkContent);
      }

      if (endIndex >= cleaned.length) {
        break;
      }

      // 오버랩만큼 뒤로 이동
      startIndex = Math.max(startIndex + 1, endIndex - this.chunkOverlap);
    }

    return chunks;
  }

  /**
   * 페이지 목록을 수신하여 페이지 정보가 보존된 청크 목록을 생성합니다.
   */
  public createChunks(
    pages: ParsedPage[],
    documentId: string,
    ragProjectId: string,
    additionalMetadata: Record<string, unknown> = {}
  ): GeneratedChunk[] {
    const result: GeneratedChunk[] = [];
    let globalChunkIndex = 0;

    for (const page of pages) {
      const pageText = TextCleaner.clean(page.text);
      if (!pageText) continue;

      const textChunks = this.chunkText(pageText);

      for (const content of textChunks) {
        result.push({
          document_id: documentId,
          rag_project_id: ragProjectId,
          chunk_index: globalChunkIndex++,
          content,
          token_count: this.estimateTokenCount(content),
          metadata: {
            ...additionalMetadata,
            page: page.pageNumber,
            char_length: content.length,
          },
        });
      }
    }

    return result;
  }
}
