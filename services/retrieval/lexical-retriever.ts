import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getProjectByDomain } from '@/lib/supabase/projects';
import { LexicalRetriever, RetrievalOptions, RetrievedChunk } from './types';
import { DomainType } from '@/types/rag';
import { RAG_CONFIG } from '@/lib/rag/config';

export class PostgresLexicalRetriever implements LexicalRetriever {
  readonly name = 'postgres-lexical-retriever';

  /**
   * 한국어 질의문에서 핵심 토큰 및 복합명사를 추출하고 한자/동의어를 확장합니다.
   */
  private extractSearchTokens(query: string): string[] {
    const raw = query.trim();
    if (!raw) return [];

    // 조사 및 특수문자 제거 후 분리
    const cleaned = raw
      .replace(/[?.,!~@#$%^&*()_+=\[\]{};':"\\|<>\/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const words = cleaned.split(' ').filter((w) => w.length >= 2);
    const tokens = new Set<string>();

    // 1. 전체 구문 (Phrase)
    if (words.length > 1 && cleaned.length <= 40) {
      tokens.add(cleaned);
    }

    // 2. 단어 및 형태소 어근 추출 (한국어 대표 조사 제거)
    const josaList = ['에서', '에게', '으로', '로써', '부터', '까지', '은', '는', '이', '가', '을', '를', '의', '과', '와', '도', '만'];

    for (const w of words) {
      tokens.add(w);
      for (const josa of josaList) {
        if (w.endsWith(josa) && w.length - josa.length >= 2) {
          tokens.add(w.slice(0, -josa.length));
        }
      }
    }

    // 3. 한의학/양생/수면 도메인 한자 및 핵심 동의어 매핑
    const domainDictionary: Record<string, string[]> = {
      '동의보감': ['東醫寶鑑', '동의보감'],
      '양생': ['養生', '양생'],
      '양생의학': ['養生醫學', '양생'],
      '수면': ['수면', 'sleep'],
      '일주기리듬': ['생체시계', '일주기', 'circadian'],
      '사상체질': ['四象', '체질', '소음인', '태음인'],
      '노인': ['고령자', '노년기'],
      '고령자': ['노인', '노년기'],
      '야간각성': ['수면유지장애', '야간 각성'],
    };

    for (const [key, syns] of Object.entries(domainDictionary)) {
      if (raw.includes(key)) {
        syns.forEach((s) => tokens.add(s));
      }
    }

    return Array.from(tokens).slice(0, 8); // 최대 8개 핵심 토큰 선정
  }

  async search(query: string, options: RetrievalOptions): Promise<RetrievedChunk[]> {
    if (!query || query.trim().length === 0) return [];
    if (!isSupabaseAdminConfigured()) return [];

    const candidateCount = options.topK ?? RAG_CONFIG.lexicalCandidateCount;
    const filters = options.filters ?? {};
    const supabase = getSupabaseAdmin();

    // 1. 도메인 프로젝트 매핑
    let projectIds: string[] | null = null;
    const targetDomains: DomainType[] = options.domains && options.domains.length > 0
      ? options.domains
      : options.domain
      ? [options.domain]
      : [];

    if (targetDomains.length > 0) {
      const projects = await Promise.all(targetDomains.map((d) => getProjectByDomain(d)));
      projectIds = projects.filter(Boolean).map((p) => p!.id);
    }

    // 2. 검색 토큰 추출
    const tokens = this.extractSearchTokens(query);
    if (tokens.length === 0) return [];

    // 3. Supabase 쿼리 빌드
    // content ILIKE 필터 조건 결합 (PostgreSQL pg_trgm 인덱스 및 ILIKE 지원)
    let queryBuilder = supabase
      .from('document_chunks')
      .select('id, document_id, rag_project_id, chunk_index, content, metadata');

    if (projectIds && projectIds.length === 1) {
      queryBuilder = queryBuilder.eq('rag_project_id', projectIds[0]);
    } else if (projectIds && projectIds.length > 1) {
      queryBuilder = queryBuilder.in('rag_project_id', projectIds);
    }

    // 토큰별 OR 조건 구성
    const orFilter = tokens.map((t) => `content.ilike.%${t}%`).join(',');
    queryBuilder = queryBuilder.or(orFilter).limit(candidateCount * 2);

    const { data: rawChunks, error } = await queryBuilder;

    if (error || !rawChunks) {
      console.warn('PostgresLexicalRetriever execution error:', error?.message);
      return [];
    }

    // 4. 한국어 Lexical Relevance Scoring (정확 구문 일치, 토큰 커버리지, 빈도 가중치)
    const scoredChunks = rawChunks.map((chunk: any) => {
      const content = chunk.content || '';
      let matchCount = 0;
      let totalFreq = 0;

      for (const token of tokens) {
        if (content.includes(token)) {
          matchCount++;
          // 토큰 출현 횟수 계산
          const freq = (content.match(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
          totalFreq += freq;
        }
      }

      // 전체 질의문 구문이 그대로 들어있으면 보너스 (Exact Phrase Matching)
      const exactPhraseBonus = content.includes(query.trim()) ? 0.35 : 0;
      const coverageScore = matchCount / Math.max(1, tokens.length);
      const frequencyScore = Math.min(0.2, totalFreq * 0.03);

      // 0.0 ~ 1.0 범위의 정규화된 키워드 스코어 산출
      const keywordScore = Math.min(1.0, parseFloat((coverageScore * 0.5 + frequencyScore + exactPhraseBonus).toFixed(4)));

      return {
        chunk,
        score: keywordScore,
      };
    });

    // 점수 내림차순 정렬
    scoredChunks.sort((a, b) => b.score - a.score);
    const topChunks = scoredChunks.slice(0, candidateCount);

    // 5. 문서 정보 조인
    const docIds = Array.from(new Set(topChunks.map((c) => c.chunk.document_id)));
    let docMap = new Map<string, { title: string; source: string | null }>();

    if (docIds.length > 0) {
      const { data: docs } = await supabase
        .from('documents')
        .select('id, title, source')
        .in('id', docIds);

      if (docs) {
        docMap = new Map(docs.map((d) => [d.id, { title: d.title, source: d.source }]));
      }
    }

    // 6. RetrievedChunk 매핑
    return topChunks.map((item, index) => {
      const c = item.chunk;
      const doc = docMap.get(c.document_id);
      const sectionTitle = (c.metadata?.section_title || c.metadata?.section || null) as string | null;

      return {
        id: c.id,
        document_id: c.document_id,
        rag_project_id: c.rag_project_id,
        chunk_index: c.chunk_index,
        content: c.content,
        document_title: doc?.title || '문서명 없음',
        document_source: doc?.source || undefined,
        domain: options.domain || targetDomains[0],
        section_title: sectionTitle,
        metadata: c.metadata || {},
        similarity: item.score,
        scores: {
          vector: null,
          keyword: item.score,
          hybrid: null,
          rerank: null,
          final: item.score,
        },
        ranks: {
          vector: null,
          keyword: index + 1,
          hybrid: null,
          rerank: null,
          final: index + 1,
        },
      };
    });
  }
}

export const lexicalRetriever = new PostgresLexicalRetriever();
