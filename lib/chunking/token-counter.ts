/**
 * 정밀 토큰 계산 유틸리티
 * 한국어, 영어, 한자(CJK), 수치, 기호의 다국어 BPE 토큰 분할 특성을 반영하여
 * 문자 수 기반 왜곡 없이 일관된 토큰 크기를 산출합니다.
 */
export class TokenCounter {
  /**
   * 텍스트의 토큰 수를 정밀하게 추정합니다.
   * - 한국어(음절): 평균 1.3 토큰/글자
   * - 한자(CJK): 평균 1.2 토큰/글자
   * - 영어 단어: 단어당 약 1.3 토큰 (약 4글자당 1토큰)
   * - 숫자 및 구두점: 기호당 약 1토큰
   */
  static count(text: string): number {
    if (!text || text.length === 0) return 0;

    let tokens = 0;

    // 1. 한국어 음절 수 카운트
    const koreanChars = (text.match(/[가-힣]/g) || []).length;
    tokens += Math.ceil(koreanChars * 1.3);

    // 2. 한자(CJK) 수 카운트
    const hanjaChars = (text.match(/[\u4E00-\u9FFF]/g) || []).length;
    tokens += Math.ceil(hanjaChars * 1.2);

    // 3. 영문 단어 수 카운트
    const englishWords = (text.match(/[a-zA-Z]+/g) || []);
    for (const word of englishWords) {
      // 5글자 이상 긴 단어는 서브워드 토큰 분할 가중치
      tokens += Math.max(1, Math.ceil(word.length / 4));
    }

    // 4. 숫자 시퀀스 카운트
    const numbers = (text.match(/[0-9]+/g) || []);
    for (const num of numbers) {
      tokens += Math.max(1, Math.ceil(num.length / 3));
    }

    // 5. 구두점 및 특수 기호 카운트
    const symbols = (text.match(/[^가-힣\u4E00-\u9FFFa-zA-Z0-9\s]/g) || []).length;
    tokens += symbols;

    // 6. 연속 공백 및 개행
    const whitespaceLines = (text.match(/\n\n+/g) || []).length;
    tokens += whitespaceLines;

    return Math.max(1, tokens);
  }

  /**
   * 토큰 단위로 텍스트를 분할할 수 있도록 단어/문장 토큰 가중치를 계산합니다.
   */
  static estimate(text: string): number {
    return this.count(text);
  }
}
