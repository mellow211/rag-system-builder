import { normalizeWhitespace } from './normalize-whitespace';
import { removeRepeatedHeaderFooter } from './remove-repeated-header-footer';
import { normalizeLineBreaks } from './normalize-line-breaks';

export interface CleanDocumentResult {
  originalText: string;
  cleanedText: string;
  stats: {
    originalLength: number;
    cleanedLength: number;
    removedChars: number;
    lineCount: number;
  };
}

/**
 * 원본 문서를 보존하면서 순차적 클리닝 파이프라인을 실행합니다.
 * 1. 화이트스페이스 및 제어 문자 정규화
 * 2. 반복 헤더/푸터 및 인쇄 페이지 번호 제거
 * 3. 줄바꿈 정규화 및 단어 결합
 */
export function cleanDocument(text: string): CleanDocumentResult {
  const originalText = text || '';
  if (!originalText.trim()) {
    return {
      originalText,
      cleanedText: '',
      stats: {
        originalLength: 0,
        cleanedLength: 0,
        removedChars: 0,
        lineCount: 0,
      },
    };
  }

  // 순차 파이프라인 실행
  let processed = normalizeWhitespace(originalText);
  processed = removeRepeatedHeaderFooter(processed);
  processed = normalizeLineBreaks(processed);

  const cleanedText = processed;

  return {
    originalText,
    cleanedText,
    stats: {
      originalLength: originalText.length,
      cleanedLength: cleanedText.length,
      removedChars: Math.max(0, originalText.length - cleanedText.length),
      lineCount: cleanedText.split('\n').length,
    },
  };
}
