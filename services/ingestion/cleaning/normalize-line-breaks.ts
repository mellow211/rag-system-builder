/**
 * PDF 줄바꿈 정규화 및 단락 경계 복원
 * - 단일 줄바꿈(\n)으로 분리된 문장 내 행들을 자연스럽게 병합
 * - 단락 간의 이중 줄바꿈(\n\n)은 보존
 * - 마크다운 헤더(#), 목록(-, *), 표(|)는 줄바꿈 보존
 */
export function normalizeLineBreaks(text: string): string {
  if (!text) return '';

  // 1. 윈도우 줄바꿈(\r\n) 및 오래된 맥 줄바꿈(\r)을 유닉스 표준(\n)으로 통일
  let normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. 3개 이상의 과도한 연속 줄바꿈을 2개(\n\n)로 정규화
  normalized = normalized.replace(/\n{3,}/g, '\n\n');

  // 3. 단락별로 분할하여 단락 내 불필요한 줄바꿈 병합
  const paragraphs = normalized.split(/\n\n+/);

  const mergedParagraphs = paragraphs.map((para) => {
    const lines = para.split('\n');
    if (lines.length <= 1) return para;

    // 헤딩, 표, 목록, Q&A는 줄바꿈을 그대로 유지해야 함
    const isSpecialBlock = lines.some((line) => {
      const trimmed = line.trim();
      return (
        trimmed.startsWith('#') ||
        trimmed.startsWith('|') ||
        /^[-*•]\s+/.test(trimmed) ||
        /^\d+[\).]\s+/.test(trimmed) ||
        /^Q[:.]/i.test(trimmed) ||
        /^A[:.]/i.test(trimmed)
      );
    });

    if (isSpecialBlock) {
      return para;
    }

    // 일반 본문 문단 내의 줄바꿈 연결 처리
    let merged = '';
    for (let i = 0; i < lines.length; i++) {
      const current = lines[i].trim();
      if (!current) continue;

      if (!merged) {
        merged = current;
      } else {
        // 이전 줄이 하이픈(-)으로 끝나면 단어 연결
        if (merged.endsWith('-')) {
          merged = merged.slice(0, -1) + current;
        } else {
          // 한국어/영어 문장 연결: 공백 하나로 이어붙임
          merged += ' ' + current;
        }
      }
    }
    return merged;
  });

  return mergedParagraphs.join('\n\n');
}
