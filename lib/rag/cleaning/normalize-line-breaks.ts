/**
 * 줄바꿈 통일, 행 끝 하이픈 단어 결합 및 과도한 빈 줄 정규화
 */
export function normalizeLineBreaks(text: string): string {
  if (!text) return '';

  return text
    // 1. CRLF 및 CR -> LF 통일
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // 2. 영어 행 끝 하이픈 단어 결합 (예: "preven-\ntive" -> "preventive")
    .replace(/([a-zA-Z가-힣])-\n([a-zA-Z가-힣])/g, '$1$2')
    // 3. 3개 이상의 반복 빈 줄 -> 2개(문단 분리 1개 빈 줄)로 정규화
    .replace(/\n{3,}/g, '\n\n')
    // 4. 문서 맨 앞과 맨 뒤 공백 정리
    .trim();
}
