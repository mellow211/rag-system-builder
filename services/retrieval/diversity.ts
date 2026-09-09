import { RetrievedChunk } from './types';
import { RAG_CONFIG } from '@/lib/rag/config';

export interface DiversityOptions {
  maxChunksPerDocument?: number;
  preventAdjacentChunks?: boolean;
}

/**
 * 검색 결과의 다양성(Diversity)을 확보하고 동일 문서 청크 편중 및 인접 중복을 필터링합니다.
 */
export function applyDiversityFilter(
  chunks: RetrievedChunk[],
  options?: DiversityOptions
): RetrievedChunk[] {
  const maxPerDoc = options?.maxChunksPerDocument ?? RAG_CONFIG.maxChunksPerDocument;
  const preventAdjacent = options?.preventAdjacentChunks ?? true;

  const selectedChunks: RetrievedChunk[] = [];
  const docChunkCount = new Map<string, number>();
  const docSelectedIndices = new Map<string, Set<number>>();
  const deferredChunks: RetrievedChunk[] = [];

  for (const chunk of chunks) {
    const docId = chunk.document_id;
    const currentCount = docChunkCount.get(docId) || 0;
    const selectedIndices = docSelectedIndices.get(docId) || new Set<number>();

    // 1. 인접 청크 검사 (예: 바로 앞뒤 chunk_index인 경우 우선순위 후순위로 유예)
    const isAdjacent =
      preventAdjacent &&
      (selectedIndices.has(chunk.chunk_index - 1) || selectedIndices.has(chunk.chunk_index + 1));

    if (currentCount >= maxPerDoc || isAdjacent) {
      deferredChunks.push(chunk);
      continue;
    }

    // 선정
    selectedChunks.push(chunk);
    docChunkCount.set(docId, currentCount + 1);
    selectedIndices.add(chunk.chunk_index);
    docSelectedIndices.set(docId, selectedIndices);
  }

  // 만약 유효한 다양성 후보가 부족할 경우 유예된 청크 중 상위 항목으로 보충
  if (selectedChunks.length < chunks.length) {
    for (const deferred of deferredChunks) {
      if (!selectedChunks.some((s) => s.id === deferred.id)) {
        selectedChunks.push(deferred);
      }
    }
  }

  return selectedChunks;
}
