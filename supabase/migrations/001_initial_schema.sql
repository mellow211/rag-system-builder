-- ==============================================================================
-- 001_initial_schema.sql
-- 고령자 건강정보 RAG Builder 시스템 초기 스키마 및 4대 도메인 시드 데이터
-- ==============================================================================

-- 1. PostgreSQL 확장 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. RAG 프로젝트 (4개 분야)
CREATE TABLE IF NOT EXISTS rag_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    domain VARCHAR(50) UNIQUE NOT NULL, -- 'health', 'yangsaeng', 'circadian', 'korean-medicine'
    description TEXT,
    color_theme VARCHAR(50) DEFAULT 'blue',
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 문서 메타데이터 테이블
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rag_project_id UUID NOT NULL REFERENCES rag_projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    source VARCHAR(255),
    publisher VARCHAR(255),
    source_url TEXT,
    document_type VARCHAR(50) DEFAULT '기타', -- '논문', '가이드라인', '공공기관 자료', '내부 문서', '기타'
    published_at DATE,
    version VARCHAR(20) DEFAULT '1.0',
    status VARCHAR(30) DEFAULT 'UPLOADED',   -- 'UPLOADED', 'PROCESSING', 'INDEXED', 'ERROR', 'ARCHIVED'
    metadata JSONB DEFAULT '{}'::jsonb,     -- 확장 필드 (age_group, disease, topic, risk_level 등)
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 문서 청크 및 벡터 저장 테이블
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    rag_project_id UUID NOT NULL REFERENCES rag_projects(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    token_count INT,
    metadata JSONB DEFAULT '{}'::jsonb, -- {"page": 1, "domain": "health", "source": "..."}
    embedding vector(1536),             -- 1536차원 벡터
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 검색 테스트 쿼리 로그 테이블
CREATE TABLE IF NOT EXISTS rag_test_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rag_project_id UUID NOT NULL REFERENCES rag_projects(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    metadata_filter JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 검색 테스트 결과 매핑 테이블
CREATE TABLE IF NOT EXISTS rag_test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_query_id UUID NOT NULL REFERENCES rag_test_queries(id) ON DELETE CASCADE,
    chunk_id UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
    rank INT NOT NULL,
    similarity_score FLOAT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(rag_project_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_chunks_doc_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_project_id ON document_chunks(rag_project_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_metadata ON document_chunks USING gin (metadata);

-- pgvector HNSW 인덱스 (코사인 유사도 검색 최적화)
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw 
ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- PostgreSQL Full Text Search 인덱스 (하이브리드 검색 확장용)
CREATE INDEX IF NOT EXISTS idx_document_chunks_content_fts 
ON document_chunks USING gin (to_tsvector('simple', content));

-- 8. 벡터 유사도 검색 함수 (Supabase RPC)
CREATE OR REPLACE FUNCTION match_document_chunks (
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.0,
    match_count int DEFAULT 5,
    filter_project_id uuid DEFAULT NULL,
    filter_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    id uuid,
    document_id uuid,
    rag_project_id uuid,
    chunk_index int,
    content text,
    metadata jsonb,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id,
        dc.document_id,
        dc.rag_project_id,
        dc.chunk_index,
        dc.content,
        dc.metadata,
        (1 - (dc.embedding <=> query_embedding))::float AS similarity
    FROM document_chunks dc
    WHERE 
        (filter_project_id IS NULL OR dc.rag_project_id = filter_project_id)
        AND dc.embedding IS NOT NULL
        AND (1 - (dc.embedding <=> query_embedding)) >= match_threshold
        AND (filter_metadata = '{}'::jsonb OR dc.metadata @> filter_metadata)
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 9. 4개 분야 RAG 프로젝트 시드 데이터
INSERT INTO rag_projects (name, domain, description, color_theme, status)
VALUES
    ('건강정보 RAG', 'health', '고령자 만성질환, 영양관리, 운동가이드, 건강정보 지식베이스', 'blue', 'ACTIVE'),
    ('양생 RAG', 'yangsaeng', '전통 양생법, 식이요법, 계절별 건강관리 지식베이스', 'green', 'ACTIVE'),
    ('일주기리듬 RAG', 'circadian', '수면 패턴, 생체시계, 채광 및 일상 리듬 건강 지식베이스', 'orange', 'ACTIVE'),
    ('한의문진 RAG', 'korean-medicine', '한의학 변증, 체질 분류, 문진 지표 지식베이스', 'purple', 'ACTIVE')
ON CONFLICT (domain) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    color_theme = EXCLUDED.color_theme,
    updated_at = NOW();

-- 10. Supabase Storage 버킷 생성 (documents)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;
