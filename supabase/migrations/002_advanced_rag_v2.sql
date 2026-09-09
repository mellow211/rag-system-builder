-- ==============================================================================
-- 002_advanced_rag_v2.sql
-- RAG v2 고급 검색 (pg_trgm, 청크 메타데이터 컬럼 확장, RAG 평가 데이터셋 스키마)
-- ==============================================================================

-- 1. pg_trgm 확장 활성화 (한국어 3-gram 부분 일치 및 키워드 유사도 고속화)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. document_chunks 테이블 컬럼 확장
ALTER TABLE document_chunks 
ADD COLUMN IF NOT EXISTS section_title TEXT,
ADD COLUMN IF NOT EXISTS parent_chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS ingestion_version VARCHAR(20) DEFAULT 'v1';

-- 3. content 대상 pg_trgm GIN 인덱스 생성 (한국어 및 한자 빠른 키워드 검색)
CREATE INDEX IF NOT EXISTS idx_document_chunks_content_trgm 
ON document_chunks USING gin (content gin_trgm_ops);

-- section_title 대상 인덱스
CREATE INDEX IF NOT EXISTS idx_document_chunks_section_title
ON document_chunks (section_title);

-- 4. RAG 평가 데이터셋 테이블
CREATE TABLE IF NOT EXISTS rag_eval_datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    domain VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. RAG 평가 질문 테이블
CREATE TABLE IF NOT EXISTS rag_eval_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID NOT NULL REFERENCES rag_eval_datasets(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    expected_document_id UUID,
    expected_chunk_id UUID,
    expected_keywords TEXT[],
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. RAG 평가 실행 이력 테이블
CREATE TABLE IF NOT EXISTS rag_eval_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID NOT NULL REFERENCES rag_eval_datasets(id) ON DELETE CASCADE,
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb, -- {"mode": "advanced-v2", "topK": 5, "rrfK": 60}
    hit_at_1 FLOAT,
    hit_at_3 FLOAT,
    hit_at_5 FLOAT,
    mrr FLOAT,
    avg_latency_ms FLOAT,
    total_questions INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. RAG 평가 질문별 상세 결과 테이블
CREATE TABLE IF NOT EXISTS rag_eval_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES rag_eval_runs(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES rag_eval_questions(id) ON DELETE CASCADE,
    retrieved_chunk_ids UUID[] DEFAULT ARRAY[]::UUID[],
    hit_at_1 BOOLEAN DEFAULT FALSE,
    hit_at_3 BOOLEAN DEFAULT FALSE,
    hit_at_5 BOOLEAN DEFAULT FALSE,
    reciprocal_rank FLOAT DEFAULT 0.0,
    latency_ms INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 평가 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_rag_eval_questions_dataset ON rag_eval_questions(dataset_id);
CREATE INDEX IF NOT EXISTS idx_rag_eval_runs_dataset ON rag_eval_runs(dataset_id);
CREATE INDEX IF NOT EXISTS idx_rag_eval_results_run ON rag_eval_results(run_id);
