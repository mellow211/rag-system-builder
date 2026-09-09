import { ParsedPage } from '../../parsers/base';

export type BlockType = 'heading' | 'paragraph' | 'list' | 'table' | 'qa';

export interface DocumentBlock {
  type: BlockType;
  text: string;
  level?: number; // 1 = h1, 2 = h2, 3 = h3, 4 = h4
  pageNumber: number;
  metadata?: Record<string, unknown>;
}

export interface ParsedPageWithBlocks extends ParsedPage {
  blocks: DocumentBlock[];
}

export interface ParsedDocument {
  documentId: string;
  title: string;
  pages: ParsedPageWithBlocks[];
  totalText: string;
  metadata?: Record<string, unknown>;
}

export interface SectionNode {
  id: string;
  title: string;
  level: number;
  parentTitle?: string | null;
  path: string[];
  pageStart: number;
  pageEnd: number;
  blocks: DocumentBlock[];
  children: SectionNode[];
}

export interface StructureChunkResult {
  parentChunks: StructureGeneratedChunk[];
  childChunks: StructureGeneratedChunk[];
  allChunks: StructureGeneratedChunk[];
  stats: {
    totalBlocks: number;
    headingsCount: number;
    tablesCount: number;
    listsCount: number;
    qaCount: number;
    parentChunksCount: number;
    childChunksCount: number;
    avgTokensPerChunk: number;
  };
}

export interface StructureGeneratedChunk {
  id?: string;
  document_id: string;
  rag_project_id: string;
  chunk_index: number;
  chunk_type: 'parent' | 'child' | 'table' | 'list' | 'qa' | 'paragraph';
  content: string;            // 사용자 화면 및 citation용 원문
  embedding_content: string;  // 검색용 context metadata 포함 텍스트
  token_count: number;
  page_start: number;
  page_end: number;
  section_title: string | null;
  section_path: string[];
  parent_chunk_id?: string | null;
  chunking_version: 'v1' | 'v2';
  metadata: {
    page?: number;
    page_start: number;
    page_end: number;
    section_title: string | null;
    section_path: string[];
    chunk_type: string;
    parent_chunk_id?: string | null;
    token_count: number;
    char_length: number;
    embedding_content: string;
    chunking_version: 'v1' | 'v2';
    [key: string]: unknown;
  };
}
