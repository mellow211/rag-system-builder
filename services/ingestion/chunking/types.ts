import { DocumentBlock, BlockType } from '../parsing/types';

export interface ChunkConfig {
  targetTokens: number;      // 기본 목표 토큰 (500)
  maxTokens: number;         // 소프트 상한 (750)
  minTokens: number;         // 최소 결합 임계치 (150)
  overlapTokens: number;     // 문장 단위 오버랩 토큰 (50)
  hardMaxTokens: number;     // 절대 상한 (1000)
}

export interface ChunkMetadata {
  page: number;
  page_start: number;
  page_end: number;
  section_title: string | null;
  section_path: string[];
  chunk_type: BlockType | 'parent' | 'section';
  parent_chunk_id?: string | null;
  token_count: number;
  char_length: number;
  domain: string;
  document_title: string;
  document_id: string;
  chunking_version: 'v1' | 'v2';
  context_text?: string;
  contextualized_content?: string;
  embedding_content?: string;
  [key: string]: unknown;
}

export interface IngestionChunk {
  id?: string;
  document_id: string;
  rag_project_id: string;
  chunk_index: number;
  chunk_type: BlockType | 'parent' | 'section';
  content: string;                 // 실제 원문 (사용자 화면/인용용)
  context_text?: string;           // LLM이 생성한 짧은 문맥 설명 (30~100 토큰)
  contextualized_content?: string; // 문맥 + 원문 결합 텍스트
  embedding_content: string;       // Vector DB 검색용 최종 텍스트
  token_count: number;
  page_start: number;
  page_end: number;
  section_title: string | null;
  section_path: string[];
  parent_chunk_id?: string | null;
  chunking_version: 'v1' | 'v2';
  metadata: ChunkMetadata;
}

export interface ChunkingResult {
  parentChunks: IngestionChunk[];
  childChunks: IngestionChunk[];
  allChunks: IngestionChunk[];
  stats: {
    totalBlocks: number;
    headingsCount: number;
    tablesCount: number;
    listsCount: number;
    qaCount: number;
    parentChunksCount: number;
    childChunksCount: number;
    avgTokensPerChunk: number;
    minTokens: number;
    maxTokens: number;
    midSentenceCutCount: number;
  };
}
