/**
 * 문서 텍스트 정제 유틸리티
 */
export class TextCleaner {
  /**
   * 원문 텍스트의 불필요한 제어 문자, 과도한 연속 공백 및 줄바꿈을 정제합니다.
   */
  static clean(text: string): string {
    if (!text) return '';

    return text
      // 1. 널 문자 및 이상 제어문자 제거
      .replace(/\0/g, '')
      .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // 2. 캐리지 리턴 통일
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // 3. 탭 및 연속 공백 정리 (단일 공백 유지)
      .replace(/[ \t]+/g, ' ')
      // 4. 줄 끝 공백 제거
      .replace(/[ \t]+\n/g, '\n')
      // 5. 3개 이상의 반복 줄바꿈 -> 2개 줄바꿈(문단 구분)으로 정규화
      .replace(/\n{3,}/g, '\n\n')
      // 6. 앞뒤 공백 정리
      .trim();
  }
}
