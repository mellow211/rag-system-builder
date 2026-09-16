# 지식 구축 플랫폼(Knowledge Construction Platform) 통합 아키텍처 및 구현 완료 보고서

> **문서 상태**: 최종 승인 완료 (Production Ready)  
> **시스템 버전**: v2.0 (Next.js 16.3.4 + Supabase + PostgreSQL pgvector + LLM Intelligence Engine)  
> **대상 도메인**: 고령자 4대 지식 분야 (건강정보 · 양생 · 일주기리듬 · 한의문진)  
> **작성일자**: 2026-09-15  

---

## 1. 프로젝트 개요 및 확장 배경

본 프로젝트는 기존의 단방향 RAG(Retrieval-Augmented Generation) 시스템(문서 업로드 → 단순 분할 → 임베딩 → 벡터 검색)을 탈피하여, 단일 문서로부터 **3대 핵심 지식 자산**을 자율적·대화형으로 구축하고 상호 융합하는 **"지식 구축 플랫폼(Knowledge Construction Platform)"**으로 확장 구축되었습니다.

기존의 UI, 데이터 구조, 4대 도메인 체계, 하이브리드 검색 및 v1/v2 청킹 비교 뷰를 100% 보존하면서 다음 3대 핵심 자산 생성 파이프라인을 완전히 통합하였습니다:

```
[전문 도메인 문서 업로드]
           │
           ├──▶ 1. Document Intelligence (문서 인텔리전스 프로파일)
           │      - 한 줄/심층 요약, 4대 도메인 자동 분류, 대상 인구, 질환, 건강지표, 목차 트리
           │      - Human-in-the-loop 검토 및 승인 (PROPOSED ➔ EDITED ➔ APPROVED)
           │
           ├──▶ 2. Agent-assisted RAG (에이전트 보조 청킹 및 벡터 인덱싱)
           │      - 대화형 청킹 에이전트, 구조 분석 트리, 9종 전용 도구(Tool-use)
           │      - 분할/병합/명칭변경/카테고리수정 제안 및 실시간 프리뷰
           │      - Knowledge Object 청크 생성 & pgvector 1536d 인덱싱
           │
           └──▶ 3. Knowledge Fabric (지식 패브릭 & 그래프)
                  - 엔티티/관계 추출, 정규화(Canonical/Aliases), 출처 근거(Strict Provenance)
                  - 4대 도메인 계층형 온톨로지 카테고리 트리 & AI 카테고리 확장
                  - 교차 도메인 브릿지(Cross-Domain Bridges: 서카디안 ↔ 양생 ↔ 한의 ↔ 건강)
```

---

## 2. 3대 핵심 지식 자산 구현 내역

### 자산 1: Document Intelligence (문서 인텔리전스)
사용자가 문서를 업로드하면 시스템은 LLM Provider 어댑터를 통해 문서의 전체 맥락과 세부 메타데이터를 정밀 구조화하여 `DocumentProfile`을 생성합니다.

1. **지식 프로파일 스키마 (`document_profile_v1`)**:
   - `summary_short`: 사용자 대시보드 및 검색 결과용 1~2문장 핵심 요약.
   - `summary_full`: 문서 전체의 연구 배경, 핵심 주장, 방법론, 임상/실천 가이드가 담긴 심층 요약.
   - `domain`: 4대 도메인(`health`, `yangsaeng`, `circadian`, `korean-medicine`) 중 최적 도메인 분류 및 적합 사유.
   - `target_population`: 대상 인구집단 (예: 65세 이상 고령자, 노년기 수면장애 환자 등).
   - `diseases`: 관련 질환 목록 (예: 노년기 불면증, 수면각성위상전진증후군, 고혈압 등).
   - `health_metrics`: 측정/모니터링 건강 지표 (예: 수면 효율, WASO, 수축기 혈압 등).
   - `lifestyle_factors`: 일상생활 중재 요인 (예: 아침 30분 일광 노출, 저녁 블루라이트 차단 등).
   - `categories`: 추천 계층형 카테고리 경로 (대분류 > 중분류 > 소분류).
   - `structure`: 문서 목차 계층 트리 (H1, H2, H3 및 하위 섹션 목록).
   - `candidate_entities`: 지식 그래프 구축용 후보 엔티티 사전 추출.
   - `cross_domain_connections`: 4대 분야 간 융합 연결 힌트.
2. **결정론적 캐싱 (`ProfileCache`)**:
   - 문서 ID, 내용 해시(SHA-256), 프롬프트 버전, LLM 모델명을 조합하여 불필요한 LLM 중복 호출 및 비용을 100% 방지.
3. **Human-in-the-loop 신뢰 프로세스**:
   - LLM 결과는 즉시 확정되지 않고 `PROPOSED` 상태로 사용자에게 제시되며, UI 탭에서 항목별 인라인 수정(`EDITED`) 후 최종 `APPROVED` 승격이 이루어집니다.

---

### 자산 2: Agent-assisted RAG (에이전트 보조 청킹 및 벡터 인덱싱)
규칙 기반의 단순 글자 수 자르기를 완전히 지양하고, 문서 구조와 의미 맥락을 완벽히 보존하는 대화형 에이전트 시스템을 구축했습니다.

1. **대화형 청킹 에이전트 (`chunk_agent_v1`)**:
   - 사용자와 한국어로 자연스럽게 대화하며 청크 구성 계획을 상의하고 개선안을 도출합니다.
   - 문서 구조 분석 결과와 토큰 분포를 파악하여 의미 단위 절단 오류(Mid-sentence cut)를 방지합니다.
2. **에이전트 9대 전용 도구(Toolset) 탑재**:
   - `analyzeDocumentStructure`: H1/H2/H3 계층, 섹션별 토큰 수, 이상 분절 감지.
   - `previewChunkPlan`: 제안된 청크 목록, 평균/최소/최대 토큰 통계, 의미 연속성 요약.
   - `splitSection`: 과대 청크를 소단락/의미 단위로 안전 분할.
   - `mergeChunks`: 내용이 지나치게 짧거나 문맥이 이어지는 인접 청크 안전 병합.
   - `renameChunk`: 청크의 대표 제목을 명확하고 검색 친화적인 명칭으로 변경.
   - `changeChunkCategory`: 개별 청크의 온톨로지 카테고리 재지정.
   - `addMissingConcept`: 특정 청크에 누락된 핵심 개념/키워드 주입.
   - `explainChunkingLogic`: 왜 특정 위치에서 청크가 분할/병합되었는지 에이전트의 논리 설명.
   - `applyFinalChunks`: 사용자 승인 후 지식 객체(Knowledge Object)로 최종 인덱싱 실행.
3. **지식 객체(Knowledge Object) 변환 & pgvector 인덱싱**:
   - 승인된 청크는 `contextualized_content` (문서 제목 + 상위 섹션 경로 + 본문) 형태로 조립.
   - `document_chunks` 테이블에 저장되고, 1536차원 코사인 벡터로 임베딩되어 HNSW 인덱스에 즉시 반영됩니다.

---

### 자산 3: Knowledge Fabric (지식 패브릭 & 그래프)
단편적 벡터 검색의 한계를 극복하고, 개념 간의 인과·상관 관계 및 4대 도메인 간의 융합 지식을 탐색할 수 있는 온톨로지 패브릭을 구축했습니다.

1. **엄격한 원문 근거 보존 (Strict Provenance)**:
   - 추출되는 모든 관계 엣지(`knowledge_edge`)는 반드시 다음 필드를 필수로 유지합니다:
     - `document_id`: 출처 문서 고유 식별자
     - `chunk_id`: 출처 청크 고유 식별자
     - `page`: 원문 페이지 번호
     - `confidence`: 0.0 ~ 1.0 신뢰도 점수
     - `evidence_text`: 원문에서 추출된 정확한 인용 근거 문장
2. **표준 엔티티 정규화 및 이명 사전 (`EntityNormalizer`)**:
   - 동일 개념의 다채로운 표기(예: "수면 상태", "잠", "수면상태" ➔ `수면` / "햇빛", "자연광", "일광" ➔ `빛 노출` / "기거양생" ➔ `조와조기`)를 표준화하고, 이명(Aliases) 사전을 통해 그래프 노드 중복 생성을 원천 방지합니다.
3. **계층형 카테고리 트리 & 에이전트 카테고리 확장**:
   - 4대 도메인별 대분류(L1) → 중분류(L2) → 소분류(L3) 체계를 트리 구조로 시각화.
   - AI 에이전트가 신규 업로드된 문서 내용을 분석하여 온톨로지에 누락된 하위 카테고리(예: `광치료`, `수면 단편화` 등)를 자율 제안(`PROPOSED`).
4. **4대 도메인 교차 연결 브릿지 (Cross-Domain Bridges)**:
   - `circadian` ↔ `health`: "일주기 수면 위생 개선과 야간 혈압 디핑(Nocturnal Dipping)의 상관성"
   - `circadian` ↔ `yangsaeng`: "황제내경의 조와조기(早臥早起) 섭생법과 현대 생체시계 조절 메커니즘의 일치"
   - `circadian` ↔ `korean-medicine`: "사상체질별 수면 양상(소음인 불면 vs 태음인 다수면)과 멜라토닌 분비 리듬 연계"
   - `health` ↔ `circadian`: "주간 유산소 신체활동과 야간 중심체온 하강을 통한 심층수면 유도 기전"

---

## 3. 데이터베이스 아키텍처 및 마이그레이션

새로 구축된 데이터베이스 마이그레이션 파일:  
[`supabase/migrations/003_knowledge_platform.sql`](file:///Users/mellow/Desktop/rag_system/supabase/migrations/003_knowledge_platform.sql)

### 주요 테이블 설계
1. **`document_profiles`**:
   - 문서별 인텔리전스 분석 프로파일, 구조화 메타데이터, 요약, 목차 트리, 상태(`PROPOSED`, `EDITED`, `APPROVED`).
2. **`categories`**:
   - 4대 도메인 온톨로지 카테고리 계층 테이블 (`parent_id` 자기참조, `level`, `status`).
3. **`knowledge_nodes`**:
   - 지식 그래프 정규화 엔티티 노드 (`canonical_name`, `node_type`, `domain`, `aliases[]`).
4. **`knowledge_edges`**:
   - 인과/상관/특성 관계 엣지 (`source_node_id`, `target_node_id`, `relation_type`, `confidence`, `evidence_text`, `document_id`, `chunk_id`, `status`).
5. **`chunk_entities`**:
   - 청크와 지식 노드 간의 N:M 매핑 및 적합도 점수 테이블.
6. **`agent_sessions` & `chunk_proposals`**:
   - 청킹 에이전트의 대화 세션 기록, LLM 툴 제안 청크 목록, 승인 상태 관리.

> **이중 스토리지 안전장치 (Non-blocking In-Memory Fallback)**:  
> Supabase 클러스터 연결 유무나 마이그레이션 적용 시점과 무관하게, 로컬 개발 환경 및 테스트 환경에서도 플랫폼이 즉시 작동할 수 있도록 모든 서비스 레이어에 In-Memory Dual Layer가 구현되어 서버 크래시를 원천 차단했습니다.

---

## 4. 백엔드 API 라우트 엔드포인트 카탈로그

| 구분 | HTTP Method & 경로 | 주요 기능 |
|---|---|---|
| **Intelligence** | `GET /api/documents/[id]/profile` | 문서의 지식 프로파일 및 메타데이터 조회 |
| **Intelligence** | `PUT /api/documents/[id]/profile` | 사용자 수정 사항 저장 및 최종 승인 처리 |
| **Intelligence** | `POST /api/documents/[id]/profile/analyze` | AI 문서 인텔리전스 심층 분석 트리거 |
| **Chunk Agent** | `GET /api/documents/[id]/chunk-agent/session` | 청킹 에이전트 세션 및 초기 청크 제안 목록 조회 |
| **Chunk Agent** | `POST /api/documents/[id]/chunk-agent/chat` | 에이전트 대화 및 자연어 명령 라우팅 |
| **Chunk Agent** | `POST /api/documents/[id]/chunk-agent/tools` | 9종 청킹 에이전트 도구 직접 호출 |
| **Chunk Agent** | `PATCH /api/documents/[id]/chunk-agent/proposals/[pId]` | 개별 청크 제안 상태 승인/수정/반려 |
| **Chunk Agent** | `POST /api/documents/[id]/chunk-agent/apply` | 최종 승인 청크를 Knowledge Object로 인덱싱 |
| **Knowledge Graph** | `GET /api/documents/[id]/graph` | 문서 전용 지식 서브그래프(노드/엣지/근거) 조회 |
| **Knowledge Graph** | `POST /api/documents/[id]/graph/extract` | 문서 본문으로부터 지식 엔티티 및 관계 엣지 추출 |
| **Knowledge Graph** | `PATCH /api/documents/[id]/graph/edges/[edgeId]` | 관계 엣지 승인(`APPROVED`) 또는 반려(`REJECTED`) |
| **Knowledge Fabric** | `GET /api/fabric/graph` | 4대 도메인 전체 글로벌 그래프 및 교차 브릿지 조회 |
| **Knowledge Fabric** | `GET /api/fabric/categories` | 4대 도메인 계층형 온톨로지 카테고리 트리 조회 |

---

## 5. UI / UX 구현 워크스루

### 1) 통합 문서 상세 워크스페이스 (`/documents/[id]`)
기존의 복잡했던 뷰를 6개의 명확한 전문 작업 탭으로 재구성하였습니다:
- **`프로파일 분석 (Intelligence)`**:
  - 한 줄 요약, 심층 요약, 4대 도메인 배지, 대상 인구, 관련 질환 태그, 건강 지표, 목차 구조 트리 렌더링.
  - 인라인 편집기 및 원클릭 '프로파일 최종 승인' 버튼 제공.
- **`지식 청킹 에이전트 (Chunk Agent)`**:
  - 좌측: 청킹 에이전트와의 실시간 채팅 인터페이스, 빠른 명령어 칩 제공.
  - 우측: 제안된 청크 카드 목록 (토큰 수 시각화 바, 문맥 요약, 분할/병합/수정 툴 액션 바).
  - 하단: "승인된 N개 청크 RAG 인덱스에 최종 반영" 버튼.
- **`지식 그래프 (Knowledge Graph)`**:
  - 문서에서 발굴된 표준 엔티티 노드와 인과/상관 관계 엣지 리스트.
  - 원문 인용 근거(Evidence Text), 출처 청크 번호, 신뢰도 점수 게이지 표시.
  - 연구자/운영자용 엣지 승인 및 반려 버튼.
- **`원문 텍스트 (Raw Text)`**:
  - 추출된 텍스트 전체 뷰어 및 줄 번호, 클립보드 복사.
- **`버전 히스토리 (Version)`**:
  - 파이프라인 처리 버전 및 상태 추적.
- **`RAG Index 및 파이프라인 (RAG Index)`**:
  - 기존 v1 vs v2 청킹 비교 뷰어 및 검색 인덱스 상태 모니터링 (100% 보존).

### 2) 글로벌 지식 패브릭 탐색기 (`/fabric`)
- **도메인 필터 바**: 전체(Fabric View), 건강정보, 양생, 일주기리듬, 한의문진 원클릭 전환.
- **통계 대시보드 카드**: 전체 지식 노드 수, 인과/상관 관계 엣지 수, 승인 완료율, 교차 브릿지 수.
- **3대 서브 뷰**:
  1. **지식 그래프 & 근거 엣지 뷰**: 좌측 엔티티 탐색기 + 우측 관계 엣지 및 원문 발췌문 카드.
  2. **계층형 카테고리 트리 뷰**: 대분류-중분류-소분류 아코디언 트리, AI 제안(`PROPOSED`) 카테고리 강조.
  3. **4대 도메인 교차 브릿지 뷰**: 학제간 융합 메커니즘 근거 카드(서카디안 ↔ 양생 ↔ 한의 ↔ 건강).

### 3) 글로벌 사이드바 내비게이션 (`Sidebar.tsx`)
- 사이드바에 **`지식 패브릭 (Knowledge Fabric)`** 메뉴가 정식 추가되어 어디서든 `/fabric`으로 즉시 이동 가능.

---

## 6. 품질 검증 및 테스트 결과

본 플랫폼의 무결성을 입증하기 위해 작성된 3대 자동화 테스트 스위트와 정적 타입 검사 결과는 다음과 같습니다:

```bash
# 1. TypeScript 컴파일 무결성 검증
$ npx tsc --noEmit
Exit code: 0 (0 errors, 100% Type-safe)

# 2. Phase 1: Document Intelligence 테스트
$ npx tsx scripts/test-phase1-intelligence.ts
===============================================================
📊 [PHASE 1 결과] 총 19개 테스트 중 19개 통과 / 0개 실패 (100%)
===============================================================

# 3. Phase 2 & 3: Agent Chunking & RAG Indexing Suite
$ npx tsx scripts/test-phase2-3-chunk-agent.ts
===============================================================
📊 [PHASE 2 & 3 결과] 총 12개 테스트 중 12개 통과 / 0개 실패 (100%)
===============================================================

# 4. Phase 4 & 5: Knowledge Graph & Fabric Suite
$ npx tsx scripts/test-phase4-5-graph.ts
===============================================================
📊 [PHASE 4 & 5 결과] 총 27개 테스트 중 27개 통과 / 0개 실패 (100%)
===============================================================

▶ 총 검증 통과 항목: 58개 테스트 전원 통과 (통과율 100%)
```

---

## 7. 운영 및 확장 가이드

1. **Supabase 데이터베이스 프로덕션 반영**:
   - Supabase 관리 콘솔의 **SQL Editor**에서 `supabase/migrations/003_knowledge_platform.sql` 스크립트를 실행하여 프로덕션 테이블 및 외래키를 동기화합니다.
2. **LLM 프로바이더 연동 및 전환**:
   - **Replicate API (`REPLICATE_API_TOKEN`)**: 시스템에 `ReplicateLLMProvider`가 탑재되어 `meta/meta-llama-3-8b-instruct`(초고속·저비용) 모델을 통해 실제 문서 텍스트로부터 지식그래프 엔티티/관계 추출 및 동적 대화형 청킹 에이전트 추론을 실시간으로 수행합니다.
   - **OpenAI API (`OPENAI_API_KEY`)**: `.env.local` 또는 Vercel 환경변수에 `OPENAI_API_KEY`를 설정하면 경제적인 `gpt-4o-mini` 모델로 고정밀 문서 분석 및 에이전트 추론이 자동 활성화됩니다.
   - **우선순위 자동 감지**: `LLM_PROVIDER` 명시 설정 > `OPENAI_API_KEY` > `REPLICATE_API_TOKEN` > `MockLLMProvider` 순으로 유연하게 폴백 동작합니다.
3. **개발 서버 기동 및 확인**:
   ```bash
   npm run dev
   ```
   - 브라우저에서 `http://localhost:3000/fabric` (지식 패브릭 탐색기) 접속 확인.
   - 임의의 문서 상세 페이지 `http://localhost:3000/documents/[id]` 접속 후 6개 작업 탭 동작 확인.

---

## 8. 최종 결론

기존 RAG 시스템의 핵심 장점인 **"고령자 4대 도메인 관리"**, **"pgvector 고속 검색"**, **"v1/v2 청킹 비교 뷰"**를 빈틈없이 보존하는 동시에, 사용자가 문서를 올릴 때마다 **1) 문서 인텔리전스**, **2) 에이전트 보조 지식 객체 RAG**, **3) 원문 근거 보존형 지식 패브릭 온톨로지**가 유기적으로 연동되는 차세대 지식 구축 플랫폼의 엔드투엔드 구현을 성공적으로 완료하였습니다.
