/**
 * 반복되는 헤더/푸터 및 저널명/발행기관 표기 제거
 */
export function removeRepeatedHeaderFooter(text: string, repeatedThreshold: number = 3): string {
  if (!text) return '';

  const lines = text.split('\n');
  const lineCounts = new Map<string, number>();

  // 짧고 반복적인 라인 빈도수 카운트
  for (const line of lines) {
    const trimmed = line.trim();
    // 5자 이상 80자 이하의 짧은 라인 중 제목 마크다운(#)이나 표(|)가 아닌 라인 대상
    if (
      trimmed.length >= 5 &&
      trimmed.length <= 80 &&
      !trimmed.startsWith('#') &&
      !trimmed.startsWith('|') &&
      !/^\d+[\).]\s+/.test(trimmed)
    ) {
      lineCounts.set(trimmed, (lineCounts.get(trimmed) || 0) + 1);
    }
  }

  // 임계치 이상 반복되는 헤더/푸터 후보군 식별
  const noisyLines = new Set<string>();
  for (const [line, count] of lineCounts.entries()) {
    const isExplicitHeader = /(?:학회지|연구원|가이드라인|지침서|보고서|저널|journal|copyright|all rights reserved|vol\.|no\.)/i.test(line);

    if ((isExplicitHeader && count >= 2) || count >= repeatedThreshold) {
      noisyLines.add(line);
    }
  }

  if (noisyLines.size === 0) {
    return text;
  }

  return lines.filter((line) => !noisyLines.has(line.trim())).join('\n');
}
