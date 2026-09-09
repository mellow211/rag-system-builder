/**
 * 문서의 반복 헤더, 푸터, 단순 인쇄 페이지 번호 노이즈를 식별하여 제거합니다.
 */
export function removeRepeatedHeaderFooter(text: string): string {
  if (!text) return '';

  const lines = text.split('\n');
  const cleanedLines: string[] = [];

  // 단순 페이지 번호 패턴 (예: "15", "- 15 -", "[ 3 ]", "Page 2 of 10", "• 4 •")
  const pageNumberPattern = /^(\s*[-–—•\(\[]?\s*\d+\s*[-–—•\)\]]?\s*|\s*page\s+\d+(\s+of\s+\d+)?\s*)$/i;

  // 저널/학술지 상단 반복 러닝 헤더 패턴 (예: "대한한의학회지 제20권 제3호 (2009년 9월)")
  const runningHeaderPattern = /^(대한.*학회지|journal of|vol\.\s*\d+|no\.\s*\d+|pp\.\s*\d+-\d+)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 빈 줄은 그대로 보존
    if (line.length === 0) {
      cleanedLines.push('');
      continue;
    }

    // 1. 단독 페이지 번호 제거
    if (pageNumberPattern.test(line)) {
      continue;
    }

    // 2. 단독 러닝 헤더 제거 (본문 제목 # 제외)
    if (!line.startsWith('#') && runningHeaderPattern.test(line) && line.length < 80) {
      continue;
    }

    cleanedLines.push(lines[i]);
  }

  return cleanedLines.join('\n');
}
