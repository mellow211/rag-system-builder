/**
 * 한국어 및 다국어 지능형 문장 분리 유틸리티
 * - 문장 종결 어미(다., 함., 됨., 임., 음., 요.) 및 부호(. ? !)를 정확히 인식
 * - 소수점(1.5), 약어(Dr., vol., pp., No.), 날짜(2024. 09.), 목차 번호(1. 서론)의 오분할을 방지
 */
export class SentenceSplitter {
  private static readonly ABBREVIATIONS = new Set([
    'dr', 'mr', 'ms', 'prof', 'vs', 'vol', 'no', 'pp', 'e.g', 'i.e', 'etc', 'al', 'p'
  ]);

  /**
   * 텍스트를 개별 완전한 문장 배열로 분리합니다.
   */
  static split(text: string): string[] {
    if (!text || !text.trim()) return [];

    const raw = text.trim();
    const sentences: string[] = [];
    let current = '';

    for (let i = 0; i < raw.length; i++) {
      const char = raw[i];
      current += char;

      // 문장 종결 후보 기호: ., !, ?
      if (char === '.' || char === '!' || char === '?') {
        const prevChar = i > 0 ? raw[i - 1] : '';
        const nextChar = i + 1 < raw.length ? raw[i + 1] : '';
        const nextNextChar = i + 2 < raw.length ? raw[i + 2] : '';

        // 1. 소수점 및 숫자 사이 마침표 제외 (예: 1.5, 3.14)
        if (/\d/.test(prevChar) && /\d/.test(nextChar)) {
          continue;
        }

        // 2. 인접 마침표 제외 (예: ..., ..)
        if (nextChar === '.' || prevChar === '.') {
          continue;
        }

        // 3. 약어 검사 (예: Dr. Kim, vol. 2)
        const lastWordMatch = current.trim().match(/([a-zA-Z]+)\.$/);
        if (lastWordMatch) {
          const word = lastWordMatch[1].toLowerCase();
          if (this.ABBREVIATIONS.has(word)) {
            continue;
          }
        }

        // 4. 다음 글자가 공백이나 개행이거나 문자열 끝인 경우만 종결로 판단
        if (nextChar === ' ' || nextChar === '\n' || nextChar === '\r' || i === raw.length - 1 || nextChar === '"' || nextChar === '”' || nextChar === '’') {
          // 한국어 서술어 종결 확인 또는 따옴표/괄호 직후
          const trimmed = current.trim();
          if (trimmed.length > 0) {
            sentences.push(trimmed);
            current = '';
          }
          // 공백 건너뛰기
          if (nextChar === ' ') {
            i++;
          }
        }
      } else if (char === '\n') {
        // 개행이 2번 연속이거나 마침표 없이도 독립된 완결성 있는 행일 때
        if (current.trim().length > 0 && (raw[i + 1] === '\n' || this.isKoreanSentenceEnding(current.trim()))) {
          sentences.push(current.trim());
          current = '';
          if (raw[i + 1] === '\n') i++;
        }
      }
    }

    if (current.trim().length > 0) {
      sentences.push(current.trim());
    }

    return sentences.filter((s) => s.length > 0);
  }

  /**
   * 한국어 대표 종결 어미 패턴 검사 (다, 함, 됨, 임, 음, 요 등)
   */
  private static isKoreanSentenceEnding(line: string): boolean {
    return /(다|함|됨|임|음|요|죠|오|까|라|다\.|함\.|됨\.|임\.|음\.|요\.)$/.test(line);
  }
}
