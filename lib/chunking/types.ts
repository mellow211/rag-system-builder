import { ParsedPage } from '../parsers/base';

export interface ChunkingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  strategy?: 'heading' | 'recursive';
}

export interface GeneratedChunk {
  document_id: string;
  rag_project_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  section_title?: string | null;
  parent_chunk_id?: string | null;
  metadata: {
    page?: number;
    char_length: number;
    section_title?: string | null;
    section?: string | null;
    heading_level?: number | null;
    ingestion_version?: string;
    [key: string]: unknown;
  };
}

export interface ChunkStrategyParams {
  pages: ParsedPage[];
  documentId: string;
  ragProjectId: string;
  additionalMetadata?: Record<string, unknown>;
  options: {
    chunkSize: number;
    chunkOverlap: number;
  };
}

export interface ChunkStrategy {
  chunk(params: ChunkStrategyParams): GeneratedChunk[];
}
