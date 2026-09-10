import { HeadingCandidate } from './types';

export class HeadingDetector {
  public static readonly CONFIDENCE_THRESHOLD = 0.70;

  /**
   * 단일 행 또는 문단 첫 행이 제목/소제목인지 감지하고 신뢰도(Confidence) 점수를 부여합니다.
   * 신뢰도 0.70 미만이면 일반 문단(paragraph)으로 처리합니다.
   */
  public static detect(line: string, isParagraphFirstLine: boolean = true): HeadingCandidate | null {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > 80) return null;

    // 1. 마크다운 명시적 헤딩 (#, ##, ###)
    const mdMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (mdMatch) {
      const level = mdMatch[1].length;
      return {
        text: mdMatch[2].trim(),
        level,
        confidence: 0.98,
        patternType: 'markdown_hash',
      };
    }

    // 2. 한국어 법령/지침서 제N장, 제N절 구조
    if (/^제\s*\d+\s*[장편부]\s*(.*)$/.test(trimmed)) {
      return {
        text: trimmed,
        level: 1,
        confidence: 0.95,
        patternType: 'korean_chapter',
      };
    }
    if (/^제\s*\d+\s*[절조항]\s*(.*)$/.test(trimmed)) {
      return {
        text: trimmed,
        level: 2,
        confidence: 0.92,
        patternType: 'korean_section',
      };
    }

    // 3. 로마자 대문자 번호 패턴: "Ⅰ. 서론", "III. 연구결과"
    const romanMatch = trimmed.match(/^([ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩI|V|X]+)\.\s*(.+)$/i);
    if (romanMatch && romanMatch[2].length <= 50) {
      return {
        text: trimmed,
        level: 1,
        confidence: 0.92,
        patternType: 'roman_numeral',
      };
    }

    // 4. 소제목 번호 계층: "1.1", "1.2.3"
    const subNumMatch = trimmed.match(/^(\d+\.\d+(?:\.\d+)?)\.?\s*(.+)$/);
    if (subNumMatch && subNumMatch[2].length <= 60) {
      const depth = subNumMatch[1].split('.').length;
      return {
        text: trimmed,
        level: Math.min(depth + 1, 4),
        confidence: 0.90,
        patternType: 'nested_numeric',
      };
    }

    // 5. 기본 번호 패턴: "1. 서론", "2. 연구 대상 및 방법"
    const numMatch = trimmed.match(/^(\d+)\.\s+([^\n]+)$/);
    if (numMatch && numMatch[2].length <= 50) {
      // 만약 끝에 '다.'나 문장 종결어미가 붙어있는 긴 문장이면 목록이나 본문일 가능성이 높음
      if (/[.!?]$/.test(numMatch[2]) || /(?:다|함|됨)\.$/.test(numMatch[2])) {
        // "1. 어르신의 수면 시간은 7시간입니다." => 번호 매긴 문장이므로 confidence 낮춤
        return {
          text: trimmed,
          level: 2,
          confidence: 0.50, // 임계치 미달로 paragraph 처리 유도
          patternType: 'numbered_sentence',
        };
      }

      return {
        text: trimmed,
        level: 2,
        confidence: 0.88,
        patternType: 'numeric_period',
      };
    }

    // 6. 한글 자모 번호 패턴: "가. 개요", "나. 대상자 선정"
    const korLetterMatch = trimmed.match(/^([가나다라마바사아자차카타파하])\.\s*(.+)$/);
    if (korLetterMatch && korLetterMatch[2].length <= 50) {
      return {
        text: trimmed,
        level: 3,
        confidence: 0.85,
        patternType: 'korean_letter',
      };
    }

    // 7. 괄호 번호 패턴: "(1) 연구 절차"
    const parenMatch = trimmed.match(/^\((\d+|[가나다])\)\s*(.+)$/);
    if (parenMatch && parenMatch[2].length <= 50 && !/[.!?]$/.test(parenMatch[2])) {
      return {
        text: trimmed,
        level: 3,
        confidence: 0.80,
        patternType: 'parenthesized_number',
      };
    }

    // 8. 대괄호 헤딩: "[머리말]", "[고령자 수면 수칙]"
    const bracketMatch = trimmed.match(/^\[([가-힣a-zA-Z0-9\s]{2,30})\]$/);
    if (bracketMatch) {
      // Q&A 문진 표기는 Q&A 블록에서 별도 처리하도록 제외
      if (bracketMatch[1].includes('문진') || bracketMatch[1].includes('Q&A')) {
        return null;
      }
      return {
        text: bracketMatch[1].trim(),
        level: 2,
        confidence: 0.78,
        patternType: 'bracketed_heading',
      };
    }

    // 9. 독립된 짧은 문장 (마침표 없이 끝나는 25자 이하의 단독 라인)
    if (
      isParagraphFirstLine &&
      trimmed.length >= 2 &&
      trimmed.length <= 25 &&
      !/[.!?]$/.test(trimmed) &&
      !/^(?:표|그림|참고|출처|Fig|Table)\b/i.test(trimmed) &&
      !/(?:입니다|합니다|됩니다|습니다|있습니다|없습니다)$/.test(trimmed)
    ) {
      return {
        text: trimmed,
        level: 2,
        confidence: 0.72, // 임계치 통과
        patternType: 'short_standalone_title',
      };
    }

    return null;
  }
}
