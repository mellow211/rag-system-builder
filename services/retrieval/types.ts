import { DomainType, SearchResultScores, SearchResultRanks } from '@/types/rag';

export interface SearchFilters {
  documentType?: string;
  source?: string;
  publisher?: string;
  year?: string;
  topic?: string;
  disease?: string;
  ageGroup?: string;
  [key: string]: unknown;
}

export interface RetrievalOptions {
  domains?: DomainType[];
  domain?: DomainType;
  topK?: number;
  threshold?: number;
  filters?: SearchFilters;
  debug?: boolean;
}

export interface RetrievedChunk {
  id: string;
  document_id: string;
  rag_project_id: string;
  chunk_index: number;
  content: string;
  document_title?: string;
  document_source?: string;
  domain?: DomainType;
  section_title?: string | null;
  metadata: {
    page?: number;
    title?: string;
    source?: string;
    publisher?: string;
    document_type?: string;
    section_title?: string | null;
    [key: string]: unknown;
  };
  similarity: number;
  scores: SearchResultScores;
  ranks: SearchResultRanks;
}

export interface Retriever {
  readonly name: string;
  search(query: string, options: RetrievalOptions): Promise<RetrievedChunk[]>;
}

export interface LexicalRetriever {
  readonly name: string;
  search(query: string, options: RetrievalOptions): Promise<RetrievedChunk[]>;
}
