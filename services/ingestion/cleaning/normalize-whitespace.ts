/**
 * 화이트스페이스, 제어문자 및 OCR 이상 공백 정규화
 */
export function normalizeWhitespace(text: string): string {
  if (!text) return '';

  return text
    // 1. 유니코드 특수 공백(NBSP, 얇은 공백 등)을 표준 공백으로 치환
    .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ')
    // 2. 인쇄 제어문자 (Form Feed, Null 등) 제거 (단, 줄바꿈 \n, \r, \t는 유지)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // 3. 한 줄 내의 연속된 2개 이상의 스페이스/탭을 단일 스페이스로 축소
    .replace(/[^\S\r\n]+/g, ' ')
    // 4. 각 줄의 앞뒤 트레일링/리딩 공백 제거
    .split('\n')
    .map((line) => line.trim())
    .join('\n');
}
