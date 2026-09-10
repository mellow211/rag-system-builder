import { DocumentBlock, BlockType } from './types';
import { HeadingDetector } from './heading-detector';

export class BlockParser {
  /**
   * 단일 페이지의 텍스트를 구조화된 DocumentBlock 목록으로 분할 파싱합니다.
   */
  public static parsePage(pageText: string, pageNumber: number): DocumentBlock[] {
    if (!pageText || !pageText.trim()) return [];

    const blocks: DocumentBlock[] = [];
    const paragraphs = pageText.split(/\n\n+/);

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      // 1. 표(Table) 블록 감지
      if (this.isTableBlock(trimmed)) {
        blocks.push({
          type: 'table',
          text: trimmed,
          pageNumber,
          metadata: { format: 'markdown_table' },
        });
        continue;
      }

      // 2. Q&A / 한의문진 블록 감지
      if (this.isQABlock(trimmed)) {
        blocks.push({
          type: 'qa',
          text: trimmed,
          pageNumber,
          metadata: { format: 'qa_questionnaire' },
        });
        continue;
      }

      // 3. 목록(List) 블록 감지
      if (this.isListBlock(trimmed)) {
        blocks.push({
          type: 'list',
          text: trimmed,
          pageNumber,
          metadata: { format: 'bullet_or_numbered_list' },
        });
        continue;
      }

      // 4. 정의(Definition) 블록 감지
      if (this.isDefinitionBlock(trimmed)) {
        blocks.push({
          type: 'definition',
          text: trimmed,
          pageNumber,
          metadata: { format: 'definition_statement' },
        });
        continue;
      }

      // 5. 헤딩(Heading) 감지
      const firstLine = trimmed.split('\n')[0].trim();
      const headingCandidate = HeadingDetector.detect(firstLine, true);

      if (headingCandidate && headingCandidate.confidence >= HeadingDetector.CONFIDENCE_THRESHOLD) {
        // 첫 줄이 헤딩이고, 뒤에 본문이 함께 있다면 헤딩과 본문을 분리
        const restOfParagraph = trimmed.slice(firstLine.length).trim();

        blocks.push({
          type: 'heading',
          text: headingCandidate.text,
          level: headingCandidate.level,
          confidence: headingCandidate.confidence,
          pageNumber,
          metadata: { pattern: headingCandidate.patternType },
        });

        if (restOfParagraph) {
          blocks.push({
            type: 'paragraph',
            text: restOfParagraph,
            pageNumber,
          });
        }
        continue;
      }

      // 6. 일반 본문 단락(Paragraph)
      blocks.push({
        type: 'paragraph',
        text: trimmed,
        pageNumber,
      });
    }

    return blocks;
  }

  /**
   * 마크다운 표 블록 판별
   */
  private static isTableBlock(text: string): boolean {
    const lines = text.split('\n');
    if (lines.length < 2) return false;

    // 파이프(|) 문자가 포함된 라인이 과반수인지 확인
    const pipeLines = lines.filter((l) => l.trim().startsWith('|') && l.trim().endsWith('|'));
    const hasSeparator = lines.some((l) => /^\|(?:\s*:?-+:?\s*\|)+$/.test(l.trim()));

    return pipeLines.length >= 2 || hasSeparator;
  }

  /**
   * Q&A / 한의문진 블록 판별 (질문, 설명, 선택지, 판정기준 결합)
   */
  private static isQABlock(text: string): boolean {
    // 1) Q: ... A: ... 패턴
    if (/Q[:.]\s*.*\nA[:.]\s*/i.test(text)) return true;

    // 2) [문진], [Q&A], [질문 항목]
    if (/^\[(?:한의문진|문진|Q&A|설문|문항)\]/i.test(text)) return true;

    // 3) 질문 및 선택지 구조 ("질문: ... 선택지: ...")
    if (text.includes('질문:') && (text.includes('선택지:') || text.includes('답변:') || text.includes('판정기준:'))) {
      return true;
    }

    // 4) 문진 문항 번호와 선택지 패턴 (예: "문항 1. ... 1) 전혀 아니다 2) 가끔 그렇다")
    if (
      /(?:문항|질문)\s*\d+/.test(text) &&
      /(?:전혀 아니다|가끔|자주|매우 그렇다|그렇지 않다)/.test(text)
    ) {
      return true;
    }

    return false;
  }

  /**
   * 목록(List) 블록 판별
   */
  private static isListBlock(text: string): boolean {
    const lines = text.split('\n');
    if (lines.length < 2) return false;

    let listLineCount = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        /^[-*•]\s+/.test(trimmed) ||
        /^\d+[\).]\s+/.test(trimmed) ||
        /^[가나다라마바사]\)\s+/.test(trimmed)
      ) {
        listLineCount++;
      }
    }

    // 절반 이상의 행이 리스트 마커로 시작하는 경우
    return listLineCount >= 2 && listLineCount / lines.length >= 0.5;
  }

  /**
   * 정의(Definition) 블록 판별
   */
  private static isDefinitionBlock(text: string): boolean {
    const trimmed = text.trim();
    if (trimmed.length > 250) return false;

    return (
      /(?:이란|이란\s+무엇인가|라\s+함은|라\s+정의한다|를\s+말한다|를\s+의미한다)\.?$/.test(trimmed) ||
      /^\[정의\]/.test(trimmed)
    );
  }
}
