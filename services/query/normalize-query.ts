/**
 * 사용자 질의 정규화 유틸리티
 * 유니코드(NFC) 정규화, 공백 정리를 수행하되 질환명, 약물명, 수치/단위(HbA1c, 65세, 7시간 등)는 원형 보존합니다.
 */
export function normalizeQuery(query: string): string {
  if (!query) return '';

  return query
    // 1. 유니코드 한글 정규화 (NFC 표준 조합형)
    .normalize('NFC')
    // 2. 널 문자 및 이상 제어문자 제거
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // 3. 특수 전각 공백 -> 일반 공백
    .replace(/[\u3000\u00A0\u2000-\u200B]/g, ' ')
    // 4. 반복 공백 단일화
    .replace(/[ \t]+/g, ' ')
    // 5. 문장 끝 단순 물음표/느낌표 정리 (의학 기호 %나 -는 보존)
    .replace(/[?!~]+$/g, '')
    .trim();
}
