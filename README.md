# 🏥 고령자 건강정보 분야별 RAG 구축·관리 시스템 (RAG Builder)

고령자 건강정보 서비스를 위한 **4대 분야별 독립 RAG 지식베이스 구축·관리·검증 관리자 웹 플랫폼**입니다.  
건강정보 데이터 관리자가 문서를 등록하고 정제, 청킹, 임베딩을 거쳐 **PostgreSQL pgvector**에 인덱싱한 뒤, 직접 자연어 질문을 입력하여 Top K 근거 청크와 유사도 점수를 검증할 수 있습니다.

---

## ✨ 핵심 기능

### 1. 4대 독립 RAG 지식베이스
- **건강정보 RAG (`health`)**: 고령자 만성질환 관리, 영양가이드, 운동 수칙 지식베이스
- **양생 RAG (`yangsaeng`)**: 전통 섭생법, 계절별 건강관리 및 식이 양생 지식베이스
- **일주기리듬 RAG (`circadian`)**: 노년기 생체시계, 수면 위생, 조와조기 지식베이스
- **한의문진 RAG (`korean-medicine`)**: 한의학 사상체질, 기혈 변증, 임상 평가 지표 지식베이스
> 💡 *개인 건강데이터(검진/복약/웨어러블)는 저장하지 않으며, 순수 건강지식 자료만 독립 공간으로 인덱싱합니다.*

### 2. 엔드투엔드 파이프라인
1. **자료 등록**: PDF, TXT, Markdown 파일 업로드 (20MB 제한, MIME 및 확장자 검증)
2. **원문 저장**: Supabase Storage `documents` 버킷
3. **텍스트 추출 & 정제**: `DocumentParser` (페이지 번호 보존) + `TextCleaner` (공백/제어문자 정규화)
4. **슬라이딩 청킹**: 800자 크기 / 150자 오버랩, 문장 경계 절단, 토큰 수 추정
5. **임베딩**: 1536차원 벡터 생성 (`OpenAI text-embedding-3-small`, `Gemini`, `Mock`)
6. **pgvector 인덱싱**: 코사인 유사도 기반 HNSW 인덱스 및 원문 본문(`content`) 동시 보존
7. **검색 검증 테스트**: 질문 입력 시 `match_document_chunks` RPC로 유사도 높은 Top 5 청크 추출

---

## 🛠 기술 스택

- **Frontend & Backend**: Next.js 16 (App Router), TypeScript, Tailwind CSS, Lucide Icons
- **Database & Storage**: Supabase (PostgreSQL 17, Storage)
- **Vector Search**: PostgreSQL `pgvector` (HNSW Cosine Vector Index)
- **Keyword Search**: PostgreSQL Full-Text Search (FTS) 인덱스 내장
- **Embedding Provider**: OpenAI / Gemini / Mock Adapter 지원

---

## 🚀 로컬 실행 방법

```bash
# 1. 의존성 설치
npm install

# 2. 로컬 개발 서버 실행
npm run dev -- -p 3005

# 3. 브라우저 접속
# http://localhost:3005
```

---

## 🌐 Vercel 배포 및 환경변수 설정

### 1. Vercel 배포 방법
1. [Vercel Dashboard](https://vercel.com/new)에 접속합니다.
2. GitHub 저장소(`mellow211/rag-system-builder`)를 선택하여 **Import**합니다.
3. **Environment Variables**에 아래 3개 필수 환경변수를 등록하고 **Deploy**를 클릭합니다.

### 2. 필수 환경변수 (Environment Variables)
```env
# Supabase 프로젝트 연동 정보
NEXT_PUBLIC_SUPABASE_URL=https://zrxbfozigqxuggkuvqkj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyeGJmb3ppZ3F4dWdna3V2cWtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4NDE1NjYsImV4cCI6MjEwNDQxNzU2Nn0.XiATPIqGBT-7Shi5ZBs4SGeB5tqNKtCsdeH3ku88oFY
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyeGJmb3ppZ3F4dWdna3V2cWtqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODg0MTU2NiwiZXhwIjoyMTA0NDE3NTY2fQ.7hX4AqDRBGNHx8KBDU0DVsyQoIkzfZ7QzBWnVqeTSfY

# 임베딩 프로바이더 설정 (mock 또는 openai)
EMBEDDING_PROVIDER=mock
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSION=1536
```

---

## 📂 프로젝트 구조

```
├── app/
│   ├── dashboard/          # 시스템 종합 대시보드
│   ├── rag/[domain]/       # 분야별 RAG 문서 관리 테이블 및 등록 모달
│   ├── rag/[domain]/test/  # RAG 검색 검증 및 유사도 확인
│   ├── documents/[id]/     # 문서 상세 및 청크 아코디언 뷰어
│   ├── settings/           # 시스템 연동 상태 점검
│   └── api/                # 업로드, 청킹, 검색, 재인덱싱 REST API
├── components/             # 사이드바, 헤더, 모달, 테이블, 카드 UI 컴포넌트
├── lib/
│   ├── supabase/           # Supabase 클라이언트 및 관리자 인스턴스
│   ├── parsers/            # PDF, TXT, Markdown 파서 인터페이스
│   ├── chunking/           # 정제기 및 슬라이딩 윈도우 청커
│   └── embedding/          # OpenAI / Gemini / Mock 어댑터
├── services/               # Ingestion 파이프라인 및 Vector/Hybrid Retrieval
└── supabase/
    └── migrations/         # DB 스키마, pgvector HNSW 인덱스, match RPC 함수
```
