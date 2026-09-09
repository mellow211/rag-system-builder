/**
 * 불필요한 연속 공백, 탭, 특수 제어 공백을 단일 공백으로 정규화합니다.
 */
export function normalizeWhitespace(text: string): string {
  if (!text) return '';

  return text
    // 널 문자 및 비가시 제어문자 제거
    .replace(/\0/g, '')
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // 전각 공백 및 특수 공백 -> 일반 공백
    .replace(/[\u3000\u00A0\u2000-\u200B\u202F\u205F]/g, ' ')
    // 탭 및 행 내부 연속 공백 정규화
    .replace(/[ \t]+/g, ' ')
    // 각 행의 앞뒤 공백 제거
    .replace(/^[ \t]+|[ \t]+$/gm, '');
}
