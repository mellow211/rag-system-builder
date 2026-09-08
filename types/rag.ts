export type DomainType = 'health' | 'yangsaeng' | 'circadian' | 'korean-medicine';

export type DocumentStatus = 'UPLOADED' | 'PROCESSING' | 'INDEXED' | 'ERROR' | 'ARCHIVED';

export type DocumentType = '논문' | '가이드라인' | '공공기관 자료' | '내부 문서' | '기타';

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
    [key: string]: unknown;
  };
  similarity: number;
  document_title?: string;
  document_source?: string;
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
