/**
 * 문장 분리기 인터페이스 (향후 Kiwi, KoNLPy 등의 다른 엔진으로 교체 가능)
 */
export interface SentenceSplitter {
  split(text: string): string[];
}

/**
 * 한국어 의학/임상 특화 문장 분리기
 * - 한국어 종결어미('다.', '한다.', '하였다.', '된다.', '있다.', '없다.', '함.', '됨.') 및 기호('.', '?', '!') 인식
 * - 소수점(3.5), 의학수치(HbA1c 6.5%), 약어(Fig. 1, p. 23, e.g., et al., Dr. Kim) 보호
 */
export class KoreanSentenceSplitter implements SentenceSplitter {
  // 약어 및 단위 분리 방지용 특수 플레이스홀더
  private static readonly PLACEHOLDER_PREFIX = '__PROTECTED_DOT_';

  public split(text: string): string[] {
    if (!text || !text.trim()) return [];

    let processed = text.trim();

    // 1. 숫자 사이의 소수점 보호: 3.5, 12.8, 0.05
    processed = processed.replace(/(\d+)\.(\d+)/g, `$1${KoreanSentenceSplitter.PLACEHOLDER_PREFIX}DECIMAL__$2`);

    // 2. 의학 및 논문 빈출 약어 보호: Fig. 1, p. 23, vol. 3, e.g., i.e., et al., Dr. Kim, no. 5
    const ABBREVIATIONS = ['Fig', 'fig', 'p', 'pp', 'vol', 'no', 'Dr', 'Prof', 'e.g', 'i.e', 'et al', 'vs', 'cf'];
    for (const abbr of ABBREVIATIONS) {
      const regex = new RegExp(`\\b(${abbr})\\.(\\s*)`, 'g');
      processed = processed.replace(regex, `$1${KoreanSentenceSplitter.PLACEHOLDER_PREFIX}ABBR__$2`);
    }

    // 3. 문장 종결 패턴 탐지
    // - (1) 표준 종결부호: ?, !
    // - (2) 마침표(.): 뒤에 공백 또는 줄바꿈이 오고, 바로 앞 단어가 한국어 종결어미(다, 함, 됨, 임, 요, 오)이거나 완전한 어절인 경우
    // 쪼갤 위치에 고유 분리 마커 주입
    const SPLIT_MARKER = '<<<__SENTENCE_BREAK__>>>';

    // (A) 물음표/느낌표 뒤 분리
    processed = processed.replace(/([?!])(?:\s+|\n+)(?=[가-힣A-Z0-9])/g, `$1${SPLIT_MARKER}`);

    // (B) 한국어 종결어미 + 마침표 뒤 분리: "합니다. ", "되었다. ", "있음. ", "됨. "
    processed = processed.replace(
      /([가-힣]{1,6}(?:다|함|됨|임|음|요|오))\.(?:\s+|\n+)(?=[가-힣A-Z0-9"'(<\[])/g,
      `$1.${SPLIT_MARKER}`
    );

    // (C) 일반 문장 마침표 + 공백 + 대문자/한글 시작
    processed = processed.replace(
      /([a-zA-Z0-9가-힣]+)\.(?:\s{1,}|\n+)(?=[가-힣A-Z"'(<\[])/g,
      `$1.${SPLIT_MARKER}`
    );

    // 4. 분리 마커 기준으로 배열 분할
    const rawSentences = processed.split(SPLIT_MARKER);

    // 5. 보호된 소수점 및 약어 복원
    return rawSentences
      .map((s) => {
        let restored = s
          .replace(new RegExp(`${KoreanSentenceSplitter.PLACEHOLDER_PREFIX}DECIMAL__`, 'g'), '.')
          .replace(new RegExp(`${KoreanSentenceSplitter.PLACEHOLDER_PREFIX}ABBR__`, 'g'), '.');
        return restored.trim();
      })
      .filter((s) => s.length > 0);
  }
}

// 기본 싱글톤 인스턴스
export const defaultSentenceSplitter = new KoreanSentenceSplitter();
