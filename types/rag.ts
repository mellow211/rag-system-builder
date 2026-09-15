export type DomainType = 'health' | 'yangsaeng' | 'circadian' | 'korean-medicine';

export type DocumentStatus =
  | 'UPLOADED'
  | 'EXTRACTING'
  | 'ANALYZING'
  | 'PROFILE_REVIEW'
  | 'CHUNKING'
  | 'CHUNK_REVIEW'
  | 'EMBEDDING'
  | 'GRAPH_BUILDING'
  | 'GRAPH_REVIEW'
  | 'READY'
  | 'ERROR'
  | 'INDEXED'
  | 'PROCESSING'
  | 'ARCHIVED';

export type DocumentType = '논문' | '가이드라인' | '공공기관 자료' | '내부 문서' | '기타';

export interface DocumentProfileSection {
  title: string;
  level: number;
  page?: number;
  subsections?: string[];
}

export interface CandidateEntity {
  name: string;
  type: string;
  description?: string;
  confidence?: number;
}

export interface CrossDomainConnection {
  domain: DomainType;
  concept: string;
  rationale: string;
}

export interface DocumentProfile {
  id?: string;
  document_id: string;
  domain: DomainType;
  document_type: string;
  summary_short: string;
  summary_full: string;
  topics: string[];
  concepts: string[];
  keywords: string[];
  target_population: string[];
  diseases: string[];
  health_metrics: string[];
  lifestyle_factors: string[];
  categories: string[];
  structure: DocumentProfileSection[];
  candidate_entities?: CandidateEntity[];
  cross_domain_connections?: CrossDomainConnection[];
  llm_model?: string;
  prompt_version: string;
  profile_version: string;
  status: 'PROPOSED' | 'EDITED' | 'APPROVED';
  created_at?: string;
  updated_at?: string;
}

export interface ChunkProposal {
  id: string;
  session_id: string;
  document_id: string;
  proposed_index: number;
  section_path: string[];
  title: string;
  proposed_content: string;
  token_count: number;
  chunk_type: string;
  category?: string;
  page_start?: number;
  page_end?: number;
  parent_id?: string | null;
  status: 'PROPOSED' | 'EDITED' | 'APPROVED' | 'REJECTED';
  created_at?: string;
}

export interface ChunkingSession {
  id: string;
  document_id: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  strategy: string;
  chat_history: Array<{ role: 'user' | 'assistant' | 'system'; content: string; timestamp?: string }>;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeNode {
  id: string;
  canonical_name: string;
  node_type: string;
  domain: DomainType;
  description?: string;
  aliases: string[];
  metadata?: Record<string, unknown>;
  status: 'PROPOSED' | 'APPROVED';
  created_at?: string;
  updated_at?: string;
}

export interface KnowledgeEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  relation_type: string;
  document_id?: string;
  chunk_id?: string;
  confidence: number;
  evidence_text?: string;
  page?: number;
  status: 'PROPOSED' | 'APPROVED' | 'REJECTED';
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  source_node?: KnowledgeNode;
  target_node?: KnowledgeNode;
}

export interface CategoryItem {
  id: string;
  name: string;
  parent_id?: string | null;
  domain: DomainType;
  description?: string;
  status: 'PROPOSED' | 'APPROVED' | 'MERGED';
  created_at?: string;
  updated_at?: string;
  children?: CategoryItem[];
}

export interface DomainConfig {
  domain: DomainType;
  name: string;
  shortName: string;
  description: string;
  themeColor: 'blue' | 'green' | 'orange' | 'purple';
  primaryHex: string;
  badgeClass: string;
  borderClass: string;
  bgLightClass: string;
  textClass: string;
}

export const DOMAIN_CONFIGS: Record<DomainType, DomainConfig> = {
  health: {
    domain: 'health',
    name: '건강정보 RAG',
    shortName: '건강정보',
    description: '고령자 만성질환, 영양관리, 운동가이드 등 보건복지/의학 건강정보',
    themeColor: 'blue',
    primaryHex: '#2563eb',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    borderClass: 'border-blue-500',
    bgLightClass: 'bg-blue-50/70',
    textClass: 'text-blue-700',
  },
  yangsaeng: {
    domain: 'yangsaeng',
    name: '양생 RAG',
    shortName: '양생',
    description: '전통 양생법, 식이요법, 계절별 건강관리 및 섭생 지식',
    themeColor: 'green',
    primaryHex: '#16a34a',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    borderClass: 'border-emerald-500',
    bgLightClass: 'bg-emerald-50/70',
    textClass: 'text-emerald-700',
  },
  circadian: {
    domain: 'circadian',
    name: '일주기리듬 RAG',
    shortName: '일주기리듬',
    description: '수면 위생, 생체시계, 채광 및 일상 활동 주기 건강 지식',
    themeColor: 'orange',
    primaryHex: '#ea580c',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
    borderClass: 'border-orange-500',
    bgLightClass: 'bg-orange-50/70',
    textClass: 'text-orange-700',
  },
  'korean-medicine': {
    domain: 'korean-medicine',
    name: '한의문진 RAG',
    shortName: '한의문진',
    description: '한의학 변증, 사상체질, 문진 질문 및 임상 평가 지표',
    themeColor: 'purple',
    primaryHex: '#9333ea',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    borderClass: 'border-purple-500',
    bgLightClass: 'bg-purple-50/70',
    textClass: 'text-purple-700',
  },
};

export interface RagProject {
  id: string;
  name: string;
  domain: DomainType;
  description: string | null;
  color_theme: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export interface RagDocument {
  id: string;
  rag_project_id: string;
  title: string;
  filename: string;
  storage_path: string;
  file_size: number | null;
  mime_type: string | null;
  source: string | null;
  publisher: string | null;
  source_url: string | null;
  document_type: DocumentType;
  published_at: string | null;
  version: string;
  status: DocumentStatus;
  metadata: {
    age_group?: string;
    disease?: string;
    topic?: string;
    risk_level?: string;
    keywords?: string[];
    [key: string]: unknown;
  };
  error_message: string | null;
  profile_version?: string;
  graph_version?: string;
  created_at: string;
  updated_at: string;
  chunks_count?: number;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  rag_project_id: string;
  chunk_index: number;
  content: string;
  token_count: number | null;
  metadata: {
    page?: number;
    title?: string;
    source?: string;
    domain?: string;
    [key: string]: unknown;
  };
  embedding?: number[];
  created_at: string;
}

export interface SearchResultScores {
  vector?: number | null;
  keyword?: number | null;
  hybrid?: number | null;
  rerank?: number | null;
  final?: number | null;
}

export interface SearchResultRanks {
  vector?: number | null;
  keyword?: number | null;
  hybrid?: number | null;
  rerank?: number | null;
  final?: number;
}

export interface SearchLatencyBreakdown {
  queryRewriteMs?: number;
  embeddingMs?: number;
  vectorSearchMs?: number;
  keywordSearchMs?: number;
  fusionMs?: number;
  rerankMs?: number;
  totalMs: number;
}

export interface SearchResultItem {
  id: string;
  document_id: string;
  rag_project_id: string;
  chunk_index: number;
  content: string;
  metadata: {
    page?: number;
    title?: string;
    source?: string;
    publisher?: string;
    document_type?: string;
    section?: string;
    section_title?: string;
    [key: string]: unknown;
  };
  similarity: number;
  document_title?: string;
  document_source?: string;
  domain?: DomainType;
  section_title?: string | null;
  scores?: SearchResultScores;
  ranks?: SearchResultRanks;
}

export interface DomainStats {
  domain: DomainType;
  name: string;
  documentCount: number;
  chunkCount: number;
  indexedCount: number;
  errorCount: number;
  lastUpdated: string | null;
}

export interface OverallStats {
  totalDocuments: number;
  totalChunks: number;
  indexedDocuments: number;
  errorDocuments: number;
  domainStats: Record<DomainType, DomainStats>;
  recentDocuments: RagDocument[];
}
