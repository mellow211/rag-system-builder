-- ==============================================================================
-- 003_knowledge_platform.sql
-- 지식 구축 플랫폼 확장 스키마:
-- 1) Document Profile
-- 2) Chunking Agent Sessions & Proposals
-- 3) Category Hierarchy
-- 4) Knowledge Graph (Nodes, Edges, Chunk-Entities)
-- 5) LLM Execution Cache
-- ==============================================================================

-- 1. documents 테이블 상태 확장 및 버전 관리 컬럼 추가
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS profile_version VARCHAR(20) DEFAULT 'v1',
ADD COLUMN IF NOT EXISTS graph_version VARCHAR(20) DEFAULT 'v1';

-- 2. Document Profile 테이블
CREATE TABLE IF NOT EXISTS document_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    domain VARCHAR(50) NOT NULL,
    document_type VARCHAR(50) DEFAULT '기타',
    summary_short TEXT,
    summary_full TEXT,
    topics JSONB DEFAULT '[]'::jsonb,
    concepts JSONB DEFAULT '[]'::jsonb,
    keywords JSONB DEFAULT '[]'::jsonb,
    target_population JSONB DEFAULT '[]'::jsonb,
    diseases JSONB DEFAULT '[]'::jsonb,
    health_metrics JSONB DEFAULT '[]'::jsonb,
    lifestyle_factors JSONB DEFAULT '[]'::jsonb,
    categories JSONB DEFAULT '[]'::jsonb,
    structure JSONB DEFAULT '[]'::jsonb,
    candidate_entities JSONB DEFAULT '[]'::jsonb,
    cross_domain_connections JSONB DEFAULT '[]'::jsonb,
    llm_model VARCHAR(100),
    prompt_version VARCHAR(50) DEFAULT 'document_profile_v1',
    profile_version VARCHAR(20) DEFAULT 'v1',
    status VARCHAR(30) DEFAULT 'PROPOSED', -- 'PROPOSED', 'EDITED', 'APPROVED'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_document_profile UNIQUE (document_id, profile_version)
);

CREATE INDEX IF NOT EXISTS idx_document_profiles_doc_id ON document_profiles(document_id);
CREATE INDEX IF NOT EXISTS idx_document_profiles_domain ON document_profiles(domain);
CREATE INDEX IF NOT EXISTS idx_document_profiles_status ON document_profiles(status);

-- 3. Chunking Sessions 및 Proposals 테이블
CREATE TABLE IF NOT EXISTS chunking_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    status VARCHAR(30) DEFAULT 'ACTIVE', -- 'ACTIVE', 'COMPLETED', 'CANCELLED'
    strategy VARCHAR(50) DEFAULT 'agent_structure',
    chat_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chunking_sessions_doc_id ON chunking_sessions(document_id);

CREATE TABLE IF NOT EXISTS chunk_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chunking_sessions(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    proposed_index INT NOT NULL,
    section_path TEXT[] DEFAULT ARRAY[]::TEXT[],
    title TEXT,
    proposed_content TEXT NOT NULL,
    token_count INT,
    chunk_type VARCHAR(50) DEFAULT 'paragraph',
    category TEXT,
    page_start INT,
    page_end INT,
    parent_id UUID,
    status VARCHAR(30) DEFAULT 'PROPOSED', -- 'PROPOSED', 'EDITED', 'APPROVED', 'REJECTED'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chunk_proposals_session ON chunk_proposals(session_id);
CREATE INDEX IF NOT EXISTS idx_chunk_proposals_doc_id ON chunk_proposals(document_id);

-- 4. 계층형 Category 테이블
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    domain VARCHAR(50) NOT NULL,
    description TEXT,
    status VARCHAR(30) DEFAULT 'APPROVED', -- 'PROPOSED', 'APPROVED', 'MERGED'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_domain ON categories(domain);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

-- 5. 지식 그래프 노드 및 엣지 (Knowledge Fabric)
CREATE TABLE IF NOT EXISTS knowledge_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_name VARCHAR(200) NOT NULL,
    node_type VARCHAR(50) NOT NULL, -- 'concept', 'disease', 'symptom', 'metric', 'factor', 'demographic', 'question'
    domain VARCHAR(50) NOT NULL,
    description TEXT,
    aliases JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(30) DEFAULT 'APPROVED',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_knowledge_node_domain_name UNIQUE (domain, canonical_name)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_domain ON knowledge_nodes(domain);
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_canonical ON knowledge_nodes(canonical_name);

CREATE TABLE IF NOT EXISTS knowledge_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_node_id UUID NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
    relation_type VARCHAR(100) NOT NULL, -- 'influences', 'affects', 'associated_with', 'has_characteristic', 'belongs_to', 'related_to'
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
    confidence FLOAT DEFAULT 1.0,
    evidence_text TEXT,
    status VARCHAR(30) DEFAULT 'PROPOSED', -- 'PROPOSED', 'APPROVED', 'REJECTED'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_edges_source ON knowledge_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_target ON knowledge_edges(target_node_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_doc ON knowledge_edges(document_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_chunk ON knowledge_edges(chunk_id);

CREATE TABLE IF NOT EXISTS chunk_entities (
    chunk_id UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
    relevance_score FLOAT DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (chunk_id, node_id)
);

-- 6. 통합 LLM 응답 캐시 테이블
CREATE TABLE IF NOT EXISTS llm_execution_cache (
    cache_key VARCHAR(255) PRIMARY KEY,
    document_id UUID,
    step VARCHAR(50) NOT NULL,
    prompt_version VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    response_json JSONB,
    response_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_cache_doc_id ON llm_execution_cache(document_id);
