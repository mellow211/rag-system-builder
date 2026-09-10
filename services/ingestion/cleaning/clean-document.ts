import { normalizeWhitespace } from './normalize-whitespace';
import { normalizeLineBreaks } from './normalize-line-breaks';
import { removePageNumberNoise } from './remove-page-number-noise';
import { removeRepeatedHeaderFooter } from './remove-repeated-header-footer';
import { MedicalTermPreserver } from './medical-term-preserver';

export interface CleanDocumentResult {
  originalText: string;
  cleanedText: string;
  stats: {
    originalLength: number;
    cleanedLength: number;
    removedChars: number;
    lineCount: number;
    medicalTermsIntact: boolean;
  };
}

/**
 * 원본 문서를 절대 변형/덮어쓰지 않고, 검색 및 구조 분석을 위한 cleaned_text를 안전하게 정제합니다.
 * - 의학 전문 용어, 수치, 단위, 한자 표기 무결성 검증
 * - 노이즈 제거: 고립된 페이지 번호, 반복 헤더/푸터, OCR 제어문자
 * - 줄바꿈 및 문단 연속성 정규화
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
        medicalTermsIntact: true,
      },
    };
  }

  // 1. 공백 및 유니코드 제어문자 정규화
  let processed = normalizeWhitespace(originalText);

  // 2. 단독 페이지 번호 노이즈 제거 ("- 1 -", "p. 14")
  processed = removePageNumberNoise(processed);

  // 3. 반복 헤더 및 푸터 노이즈 제거
  processed = removeRepeatedHeaderFooter(processed);

  // 4. 줄바꿈 정규화 및 문장 연속성 복원
  processed = normalizeLineBreaks(processed);

  const cleanedText = processed.trim();

  // 5. 의학 및 한의학 전문 용어 보존 검증
  const termCheck = MedicalTermPreserver.verifyIntegrity(originalText, cleanedText);

  return {
    originalText,
    cleanedText,
    stats: {
      originalLength: originalText.length,
      cleanedLength: cleanedText.length,
      removedChars: Math.max(0, originalText.length - cleanedText.length),
      lineCount: cleanedText ? cleanedText.split('\n').length : 0,
      medicalTermsIntact: termCheck.intact,
    },
  };
}
