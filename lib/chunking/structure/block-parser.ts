import { DocumentBlock, BlockType } from './types';
import { cleanDocument } from '../../rag/cleaning/clean-document';

export class BlockParser {
  /**
   * 단일 페이지 텍스트를 구조화된 DocumentBlock 배열로 파싱합니다.
   */
  static parsePage(pageText: string, pageNumber: number): DocumentBlock[] {
    const cleaned = cleanDocument(pageText).cleanedText;
    if (!cleaned || cleaned.trim().length === 0) return [];

    const lines = cleaned.split('\n');
    const blocks: DocumentBlock[] = [];

    let currentLines: string[] = [];
    let currentType: BlockType = 'paragraph';
    let currentHeadingLevel: number | undefined = undefined;

    const flushBlock = () => {
      if (currentLines.length === 0) return;
      const text = currentLines.join('\n').trim();
      if (text.length > 0) {
        blocks.push({
          type: currentType,
          text,
          level: currentHeadingLevel,
          pageNumber,
        });
      }
      currentLines = [];
      currentType = 'paragraph';
      currentHeadingLevel = undefined;
    };

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // 빈 줄 처리: 현재 블록이 리스트나 테이블이 아니면 블록 경계로 간주
      if (trimmed.length === 0) {
        if (currentType !== 'table') {
          flushBlock();
        }
        i++;
        continue;
      }

      // 1. Table 감지 (Markdown 표: | 로 시작하거나 | 가 2개 이상 포함된 행)
      if (this.isTableLine(trimmed)) {
        if (currentType !== 'table') {
          flushBlock();
          currentType = 'table';
        }
        currentLines.push(trimmed);
        i++;
        continue;
      } else if (currentType === 'table') {
        flushBlock();
      }

      // 2. QA / 한의문진 항목 감지 (Q:, 문1., [문진], 질문:, 증상:)
      if (this.isQaLine(trimmed)) {
        flushBlock();
        currentType = 'qa';
        currentLines.push(trimmed);
        // 다음 줄들이 답변(A:)이나 설명인 경우 함께 묶음
        while (i + 1 < lines.length && lines[i + 1].trim().length > 0 && !this.detectHeading(lines[i + 1].trim()).isHeading) {
          i++;
          currentLines.push(lines[i].trim());
        }
        flushBlock();
        i++;
        continue;
      }

      // 3. Heading 감지
      const headingInfo = this.detectHeading(trimmed);
      if (headingInfo.isHeading) {
        flushBlock();
        blocks.push({
          type: 'heading',
          text: headingInfo.title,
          level: headingInfo.level,
          pageNumber,
        });
        i++;
        continue;
      }

      // 4. List 항목 감지 (- , * , 1) , • , ① )
      if (this.isListLine(trimmed)) {
        if (currentType !== 'list') {
          flushBlock();
          currentType = 'list';
        }
        currentLines.push(trimmed);
        i++;
        continue;
      } else if (currentType === 'list') {
        // 리스트 바로 다음의 연속 들여쓰기 행은 동일 리스트로 유지
        if (line.startsWith('   ') || line.startsWith('\t')) {
          currentLines.push(trimmed);
          i++;
          continue;
        } else {
          flushBlock();
        }
      }

      // 5. 일반 Paragraph
      if (currentType !== 'paragraph') {
        flushBlock();
        currentType = 'paragraph';
      }
      currentLines.push(trimmed);
      i++;
    }

    flushBlock();
    return blocks;
  }

  /**
   * 표 라인 검사
   */
  private static isTableLine(line: string): boolean {
    return (line.startsWith('|') && line.endsWith('|')) || (line.includes('|') && line.split('|').length >= 3);
  }

  /**
   * QA / 문진 라인 검사
   */
  private static isQaLine(line: string): boolean {
    return /^(Q[:.]|질문[:.]|문\s*\d+[:.]|\[문진|문진\s*항목|증상\s*평가|\[Q&A\])/i.test(line);
  }

  /**
   * List 항목 검사
   */
  private static isListLine(line: string): boolean {
    return /^([-*•+]\s+|\d+[.)]\s+|[①②③④⑤⑥⑦⑧⑨⑩]\s+|\([a-zA-Z0-9가-힣]\)\s+)/.test(line);
  }

  /**
   * Heading 정밀 감지
   * - Markdown #~####
   * - 번호형 목차 (1. 서론, 1.1, 가., Ⅰ.)
   * - 끝에 마침표 없는 독립 행 단락 제목
   * - 서술어 종결(다., 습니다., 하였다.)이 있는 문장은 Heading에서 제외
   */
  private static detectHeading(line: string): { isHeading: boolean; title: string; level: number } {
    // 서술어 종결형 문장은 제목이 아님
    if (/(다\.|습니다\.|하였다\.|였다\.|한다\.|된다\.|이다\.)$/.test(line)) {
      return { isHeading: false, title: line, level: 0 };
    }

    // 1. Markdown # 대제목/소제목
    const mdMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (mdMatch) {
      return {
        isHeading: true,
        title: mdMatch[2].trim(),
        level: mdMatch[1].length,
      };
    }

    // 2. 번호 패턴 (1., 1.1, 제1장, Ⅰ., 가.)
    const numMatch = line.match(/^(제\s*\d+\s*[장절편]|[\d]+(\.[\d]+)*\.|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩIVXLCDM]+\.|[가-하]\.)\s*(.+)$/);
    if (numMatch && line.length <= 60) {
      const level = numMatch[1].includes('.') && numMatch[1].split('.').length > 2 ? 3 : 2;
      return {
        isHeading: true,
        title: line.trim(),
        level,
      };
    }

    // 3. 대괄호 제목 (예: [머리말], [결어 및 참고문헌])
    const bracketMatch = line.match(/^\[([가-힣a-zA-Z0-9\s]{2,30})\]$/);
    if (bracketMatch) {
      return {
        isHeading: true,
        title: bracketMatch[1].trim(),
        level: 2,
      };
    }

    // 4. 마침표 없는 짧은 단독 행 (35자 이하, 한자/한글 포함)
    if (line.length <= 35 && !line.includes('.') && !line.includes(',') && /^[가-힣a-zA-Z0-9\s\u4E00-\u9FFF]{2,35}$/.test(line)) {
      // 일반 대화나 명사구 제목인 경우
      const commonTitleKeywords = ['머리말', '서론', '본론', '결어', '결론', '고찰', '참고문헌', '요약', '개요', '원칙', '지침', '방법'];
      if (commonTitleKeywords.some((k) => line.includes(k))) {
        return {
          isHeading: true,
          title: line.trim(),
          level: 2,
        };
      }
    }

    return { isHeading: false, title: line, level: 0 };
  }
}
