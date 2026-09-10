/**
 * 문서 내에 고립된 페이지 번호 노이즈 제거
 * 예: "- 1 -", "p. 14", "1 / 20", "12 of 35", 줄 단독 숫자
 */
export function removePageNumberNoise(text: string): string {
  if (!text) return '';

  const lines = text.split('\n');
  const filteredLines = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;

    // 1. 대시 감싼 페이지 번호: "- 1 -", "- 12 -"
    if (/^-\s*\d+\s*-$/.test(trimmed)) return false;

    // 2. 단독 페이지 표기: "p. 12", "P. 12", "Page 3", "[12]"
    if (/^(?:p\.|page)\s*\d+$/i.test(trimmed)) return false;

    // 3. 전체 대비 페이지 표기: "1 / 15", "12 of 30"
    if (/^\d+\s*(?:\/|of)\s*\d+$/i.test(trimmed)) return false;

    // 4. 순수 숫자만 한 줄에 존재하는 경우 (1~4자리 숫자 단독 행)
    if (/^\d{1,4}$/.test(trimmed)) return false;

    return true;
  });

  return filteredLines.join('\n');
}
