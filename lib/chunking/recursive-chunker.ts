import { ChunkStrategy, ChunkStrategyParams, GeneratedChunk } from './types';
import { cleanDocument } from '../rag/cleaning/clean-document';

export class RecursiveChunkStrategy implements ChunkStrategy {
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 1.7);
  }

  chunk(params: ChunkStrategyParams): GeneratedChunk[] {
    const { pages, documentId, ragProjectId, additionalMetadata = {}, options } = params;
    const { chunkSize, chunkOverlap } = options;

    const result: GeneratedChunk[] = [];
    let globalChunkIndex = 0;

    for (const page of pages) {
      const cleaned = cleanDocument(page.text).cleanedText;
      if (!cleaned) continue;

      const subChunks = this.splitTextByTokens(cleaned, chunkSize, chunkOverlap);
      for (const content of subChunks) {
        result.push({
          document_id: documentId,
          rag_project_id: ragProjectId,
          chunk_index: globalChunkIndex++,
          content,
          token_count: this.estimateTokens(content),
          metadata: {
            ...additionalMetadata,
            page: page.pageNumber,
            char_length: content.length,
            ingestion_version: 'rag-v2',
          },
        });
      }
    }

    return result;
  }

  private splitTextByTokens(text: string, chunkSize: number, chunkOverlap: number): string[] {
    if (text.length <= chunkSize) {
      return [text];
    }

    const chunks: string[] = [];
    let startIndex = 0;

    while (startIndex < text.length) {
      let endIndex = startIndex + chunkSize;

      if (endIndex < text.length) {
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
