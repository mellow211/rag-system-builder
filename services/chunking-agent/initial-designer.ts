import { randomUUID } from 'crypto';
import { ChunkProposal, DocumentProfile } from '@/types/rag';
import { getLLMProvider } from '@/services/llm';
import { TokenCounter } from '@/lib/chunking/token-counter';
import { cleanDocument } from '../ingestion/cleaning/clean-document';
import { BlockParser } from '../ingestion/parsing/block-parser';

export interface InitialDesignResult {
  sessionId: string;
  proposals: ChunkProposal[];
  welcomeMessage: string;
  detectedSections: Array<{ title: string; category: string; chunkCount: number }>;
}

export class InitialChunkDesigner {
  /**
   * 다단계(Multi-step) LLM 에이전트 분석을 통해 문서의 실제 구조에 맞춤화된 초기 Chunk Proposal 목록을 생성합니다.
   * 1단계: 문서 구조 및 학술/표준 섹션 식별 (초록, 서론, 방법, 결과, 고찰, 결론 등)
   * 2단계: 섹션별 맞춤 분할 전략 수립 (토큰 크기, 보존 규칙, 카테고리 매핑)
   * 3단계: 의미 단위 청크 제안 및 메타데이터 합성
   * 4단계: 에이전트 3단계 추론 보고서 작성
   */
  public static async design(
    documentId: string,
    doc: any,
    parsedPages: Array<{ pageNumber: number; text: string }>,
    existingProfile?: DocumentProfile | null
  ): Promise<InitialDesignResult> {
    const sessionId = randomUUID();
    const provider = getLLMProvider();

    // 1. 전체 클리닝된 페이지 텍스트 구성
    const cleanedPages = parsedPages.map((p, idx) => ({
      pageNumber: p.pageNumber ?? idx + 1,
      text: cleanDocument(p.text).cleanedText,
    }));

    const fullCleanedText = cleanedPages.map((p) => p.text).join('\n\n');
    const docTitle = doc?.title || doc?.filename || '문서';
    const domain = (doc?.metadata?.domain as string) || (doc?.rag_project_id as string) || 'health';

    // 2. [Step 1] 문서 구조 및 표준 섹션 식별
    let identifiedSections: Array<{
      title: string;
      category: string;
      description?: string;
    }> = [];

    // 2-A. 기존 DocumentProfile의 structure 활용 확인
    if (existingProfile?.structure && existingProfile.structure.length >= 2) {
      identifiedSections = existingProfile.structure.map((s) => ({
        title: s.title,
        category: this.normalizeCategoryName(s.title),
        description: s.subsections?.join(', '),
      }));
    }

    // 2-B. LLM 개입을 통한 논문/문서 섹션 정밀 식별
    if (identifiedSections.length < 2 && fullCleanedText.length > 100) {
      try {
        const outlineSample = fullCleanedText.slice(0, 4000);
        const sectionDetectionPrompt = `[문서 제목]: ${docTitle}
[문서 분야]: ${domain}
[문서 초반 텍스트 발췌]:
${outlineSample}

위 문서를 정밀 분석하여, 문서의 실제 핵심 섹션(예: 학술 논문의 경우 초록, 서론, 연구방법, 연구결과, 고찰, 결론 / 건강지침서의 경우 개요, 진단, 양생치료, 주의사항 등)을 식별하라.
모든 본문을 "서론"이나 한 가지 섹션으로 몰아넣지 말고, 본문의 실제 흐름에 맞는 3~7개의 섹션 목록을 구성하라.`;

        const detectionResult = await provider.generateStructured<{
          sections: Array<{ title: string; category: string; description: string }>;
        }>({
          systemPrompt: '너는 학술 논문 및 전문 건강의학 문서 구조 분석 수석 아키텍트이다. 문서의 실제 목차와 대주제를 정밀하게 분리 식별하라.',
          prompt: sectionDetectionPrompt,
          schemaName: 'DocumentSectionsDetection',
          schema: {
            type: 'object',
            properties: {
              sections: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string', description: '섹션 대표 명칭 (예: "서론: 일주기 생체시계의 기전", "연구 방법 및 대상")' },
                    category: { type: 'string', description: '섹션 카테고리 (예: "초록", "서론", "연구방법", "연구결과", "고찰", "결론", "임상지침" 중 하나)' },
                    description: { type: 'string', description: '해당 섹션의 주요 다루는 내용 요약' },
                  },
                  required: ['title', 'category'],
                },
              },
            },
            required: ['sections'],
          },
          temperature: 0.1,
          maxTokens: 1000,
        });

        if (detectionResult.sections && detectionResult.sections.length >= 2) {
          identifiedSections = detectionResult.sections;
        }
      } catch (llmErr) {
        console.warn('[InitialChunkDesigner] LLM 섹션 식별 폴백:', llmErr);
      }
    }

    // 2-C. 휴리스틱 섹션 식별 폴백 (논문/보고서 패턴 자동 감지)
    if (identifiedSections.length < 2) {
      identifiedSections = this.heuristicIdentifySections(fullCleanedText, docTitle);
    }

    // 3. [Step 2 & 3] 섹션별 블록 수집 및 지능형 청크 제안 생성
    // 페이지별 블록 파싱 (강화된 HeadingDetector 및 BlockParser 사용)
    const allBlocksWithMeta: Array<{
      text: string;
      type: string;
      pageNumber: number;
      headingTitle?: string;
    }> = [];

    for (const p of cleanedPages) {
      const pageBlocks = BlockParser.parsePage(p.text, p.pageNumber);
      for (const b of pageBlocks) {
        allBlocksWithMeta.push({
          text: b.text,
          type: b.type,
          pageNumber: b.pageNumber,
          headingTitle: b.type === 'heading' ? b.text : undefined,
        });
      }
    }

    // 블록들을 섹션별로 묶어 의미 단위 청크 합성
    const proposals: ChunkProposal[] = [];
    let currentHeading = identifiedSections[0]?.title || '서론';
    let currentCategory = identifiedSections[0]?.category || '서론';

    let chunkBuffer: string[] = [];
    let chunkTokens = 0;
    let chunkStartPage = cleanedPages[0]?.pageNumber || 1;
    let chunkEndPage = chunkStartPage;
    let chunkType = 'paragraph';
    let propIndex = 1;

    const flushChunk = () => {
      if (chunkBuffer.length === 0) return;
      const content = chunkBuffer.join('\n\n').trim();
      if (!content) return;

      const tokens = TokenCounter.count(content);
      const shortTitle = this.synthesizeChunkTitle(content, currentHeading, currentCategory, propIndex);

      proposals.push({
        id: randomUUID(),
        session_id: sessionId,
        document_id: documentId,
        proposed_index: propIndex++,
        title: shortTitle,
        section_path: [currentHeading],
        chunk_type: chunkType,
        category: currentCategory,
        proposed_content: content,
        token_count: tokens,
        page_start: chunkStartPage,
        page_end: chunkEndPage,
        status: 'PROPOSED',
        created_at: new Date().toISOString(),
      });

      chunkBuffer = [];
      chunkTokens = 0;
      chunkType = 'paragraph';
    };

    // 타겟 토큰 크기 (섹션 특성 반영: 방법/결과는 표·수치 보존 350~450, 서론/고찰은 450~550)
    const getTargetTokensForCategory = (cat: string) => {
      if (cat.includes('방법') || cat.includes('결과')) return 380;
      if (cat.includes('초록') || cat.includes('결론')) return 300;
      return 450;
    };

    for (let i = 0; i < allBlocksWithMeta.length; i++) {
      const b = allBlocksWithMeta[i];

      // 헤딩 블록이거나 본문 내 섹션 전환 감지
      if (b.type === 'heading') {
        const matchedSection = identifiedSections.find(
          (s) =>
            b.text.includes(s.title) ||
            s.title.includes(b.text) ||
            this.isSectionKeywordMatch(b.text, s.category)
        );

        if (matchedSection) {
          // 기존 모인 버퍼 플러시
          flushChunk();
          currentHeading = b.text;
          currentCategory = matchedSection.category;
          chunkStartPage = b.pageNumber;
          chunkEndPage = b.pageNumber;
          chunkType = 'heading';
          continue;
        } else {
          // 일반 소제목인 경우
          const detectedCategory = this.normalizeCategoryName(b.text);
          if (detectedCategory !== currentCategory && this.isKnownAcademicCategory(detectedCategory)) {
            flushChunk();
            currentHeading = b.text;
            currentCategory = detectedCategory;
            chunkStartPage = b.pageNumber;
            chunkEndPage = b.pageNumber;
            continue;
          }
        }
      }

      // 본문 텍스트 내에서 섹션 헤딩이 일반 텍스트로 시작하는지 검사
      const inlineCatMatch = this.detectInlineSectionHeading(b.text);
      if (inlineCatMatch && inlineCatMatch !== currentCategory) {
        flushChunk();
        currentHeading = inlineCatMatch;
        currentCategory = inlineCatMatch;
        chunkStartPage = b.pageNumber;
        chunkEndPage = b.pageNumber;
      }

      const blockTokens = TokenCounter.count(b.text);
      const targetTokens = getTargetTokensForCategory(currentCategory);

      if (chunkTokens > 0 && chunkTokens + blockTokens > targetTokens) {
        flushChunk();
        chunkStartPage = b.pageNumber;
      }

      chunkBuffer.push(b.text);
      chunkTokens += blockTokens;
      chunkEndPage = b.pageNumber;
      if (b.type === 'table' || b.type === 'qa') {
        chunkType = b.type;
      }
    }

    // 잔여 버퍼 플러시
    flushChunk();

    // 청크가 너무 적게(1개) 나왔을 경우의 안전 분할
    if (proposals.length <= 1 && fullCleanedText.length > 500) {
      proposals.length = 0;
      const paragraphs = fullCleanedText.split(/\n\n+/).filter((p) => p.trim().length > 0);
      let pIdx = 1;
      for (const para of paragraphs) {
        const pTokens = TokenCounter.count(para);
        const pCat = this.guessCategoryFromText(para, identifiedSections);
        proposals.push({
          id: randomUUID(),
          session_id: sessionId,
          document_id: documentId,
          proposed_index: pIdx++,
          title: `[${pCat}] ${docTitle} #${pIdx - 1}`,
          section_path: [pCat],
          chunk_type: 'paragraph',
          category: pCat,
          proposed_content: para,
          token_count: pTokens,
          page_start: 1,
          page_end: 1,
          status: 'PROPOSED',
          created_at: new Date().toISOString(),
        });
      }
    }

    // 4. [Step 4] 섹션별 청크 통계 및 에이전트 브리핑 메시지 합성
    const sectionStats = new Map<string, number>();
    for (const p of proposals) {
      const cat = p.category || '기본';
      sectionStats.set(cat, (sectionStats.get(cat) || 0) + 1);
    }

    const detectedSectionsSummary = Array.from(sectionStats.entries()).map(([cat, count]) => ({
      title: cat,
      category: cat,
      chunkCount: count,
    }));

    const welcomeMessage = this.buildAgentWelcomeReport(
      docTitle,
      proposals.length,
      detectedSectionsSummary
    );

    return {
      sessionId,
      proposals,
      welcomeMessage,
      detectedSections: detectedSectionsSummary,
    };
  }

  /**
   * 학술 섹션 카테고리 정규화
   */
  public static normalizeCategoryName(title: string): string {
    const t = title.replace(/\s+/g, '');
    if (/초록|Abstract/i.test(t)) return '초록';
    if (/서론|배경|연구배경|Introduction|Background/i.test(t)) return '서론';
    if (/방법|연구방법|대상및방법|연구대상|Materials|Methods/i.test(t)) return '연구방법';
    if (/결과|연구결과|실험결과|Results/i.test(t)) return '연구결과';
    if (/고찰|논의|Discussion/i.test(t)) return '고찰';
    if (/결론|제언|결어|Conclusion/i.test(t)) return '결론';
    if (/참고문헌|References/i.test(t)) return '참고문헌';
    if (/치료|처방|양생|관리|가이드/i.test(t)) return '임상양생';
    return title.slice(0, 15);
  }

  private static isKnownAcademicCategory(cat: string): boolean {
    return ['초록', '서론', '연구방법', '연구결과', '고찰', '결론', '참고문헌'].includes(cat);
  }

  private static isSectionKeywordMatch(text: string, category: string): boolean {
    const norm = this.normalizeCategoryName(text);
    return norm === category;
  }

  private static detectInlineSectionHeading(text: string): string | null {
    const firstLine = text.trim().split('\n')[0].trim();
    if (firstLine.length > 35) return null;
    const cat = this.normalizeCategoryName(firstLine);
    if (this.isKnownAcademicCategory(cat) && !/(?:다|함|됨)\.$/.test(firstLine)) {
      return cat;
    }
    return null;
  }

  /**
   * 휴리스틱 기반 문서 섹션 식별 (논문 7대 구조)
   */
  private static heuristicIdentifySections(
    fullText: string,
    docTitle: string
  ): Array<{ title: string; category: string }> {
    const sections: Array<{ title: string; category: string }> = [];

    const candidates = [
      { pattern: /초\s*록|Abstract/i, title: '초록 (Abstract)', category: '초록' },
      { pattern: /서\s*론|연구\s*배경|Introduction/i, title: '서론 및 연구 배경', category: '서론' },
      { pattern: /연구\s*방법|대상\s*및\s*방법|Methods/i, title: '연구 방법 및 절차', category: '연구방법' },
      { pattern: /연구\s*결과|결\s*과|Results/i, title: '연구 결과 분석', category: '연구결과' },
      { pattern: /고\s*찰|논\s*의|Discussion/i, title: '고찰 및 임상적 의의', category: '고찰' },
      { pattern: /결\s*론|결론\s*및\s*제언|Conclusion/i, title: '결론 및 종합 제언', category: '결론' },
    ];

    for (const c of candidates) {
      if (c.pattern.test(fullText)) {
        sections.push({ title: c.title, category: c.category });
      }
    }

    if (sections.length < 2) {
      // 일반 보고서 기본 3단 구조
      return [
        { title: '1. 서론 및 개요', category: '서론' },
        { title: '2. 본문 및 핵심 분석', category: '연구결과' },
        { title: '3. 고찰 및 결론', category: '결론' },
      ];
    }

    return sections;
  }

  private static guessCategoryFromText(
    text: string,
    sections: Array<{ title: string; category: string }>
  ): string {
    for (const s of sections) {
      if (text.includes(s.title) || text.includes(s.category)) {
        return s.category;
      }
    }
    if (/방법|대상|실험|측정|표본/i.test(text)) return '연구방법';
    if (/결과|유의|통계|증가|감소|표|Table|p</i.test(text)) return '연구결과';
    if (/고찰|논의|기전|임상|연관|의의/i.test(text)) return '고찰';
    if (/결론|제언|요약|시사/i.test(text)) return '결론';
    return sections[0]?.category || '서론';
  }

  /**
   * 청크 내용 기반 직관적인 한글 제목 합성
   */
  private static synthesizeChunkTitle(
    content: string,
    heading: string,
    category: string,
    index: number
  ): string {
    const firstSentence = content.split(/[.!?\n]/)[0].trim();
    let topicSnippet = '';
    if (firstSentence && firstSentence.length >= 5 && firstSentence.length <= 35) {
      topicSnippet = firstSentence.replace(/^[-*•\d.)\s]+/, '');
    } else if (firstSentence && firstSentence.length > 35) {
      topicSnippet = firstSentence.slice(0, 25) + '...';
    }

    if (topicSnippet) {
      return `[${category}] ${topicSnippet}`;
    }

    return `[${category}] ${heading} #${index}`;
  }

  /**
   * 에이전트 3단계 추론 보고서 웰컴 메시지 작성
   */
  private static buildAgentWelcomeReport(
    docTitle: string,
    totalCount: number,
    sections: Array<{ title: string; category: string; chunkCount: number }>
  ): string {
    const sectionListText = sections
      .map((s) => `  - **[${s.category}]** 섹션: ${s.chunkCount}개 청크`)
      .join('\n');

    return `반갑습니다! **AI 청킹 설계 전문 수석 에이전트**입니다.
문서 **"${docTitle}"**의 다단계(Multi-step) 구조 분석을 완료하여 총 **${totalCount}개의 청크 제안(Chunk Plan)**을 체계적으로 수립했습니다.

📋 **에이전트 3단계 청크 설계 보고서**:
1. **문서 구조 & 섹션 식별 완료**:
   단순 문자수 분할을 지양하고 본문의 실제 학술/전문 구조를 감지하여 특정 섹션(예: 서론)으로 쏠리지 않도록 독립 분류했습니다.
${sectionListText}

2. **섹션별 분할 전략 적용**:
   - 방법 및 결과 섹션: 수치, 표, 측정 프로토콜 보호를 위한 300~400 토큰 단위 분할
   - 서론 및 고찰 섹션: 논리적 맥락과 연구 배경 보존을 위한 400~500 토큰 단위 분할

3. **대화형 청크 수정 준비 완료**:
   좌측의 [문서 구조 Tree]와 아래 청크 제안 목록을 확인해 보세요.
   원하시는 조정 사항이 있다면 자연어로 편하게 말씀해 주세요!

💬 **추천 대화 예시**:
- *"3번부터 5번까지 카테고리를 '연구방법'으로 변경해줘"*
- *"2번 청크 제목을 '피험자 선정 기준'으로 바꿔줘"*
- *"1번과 2번 청크 하나로 합쳐줘"*
- *"4번 청크 내용이 긴데 2개로 분할해줘"*
- *"이대로 승인해줘"*`;
  }
}
