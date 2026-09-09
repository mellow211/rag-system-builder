import Replicate from 'replicate';
import { ParsedPage } from '../parsers/base';

export interface MarkerOcrOptions {
  mode?: 'fast' | 'balanced' | 'accurate';
  forceOcr?: boolean;
  paginate?: boolean;
}

export interface MarkerOcrResult {
  markdown: string;
  pages: ParsedPage[];
  metadata?: Record<string, unknown>;
}

/**
 * Replicate의 datalab-to/marker 모델을 호출하여 PDF 문서를 고품질 구조화 Markdown으로 변환합니다.
 * GPT-4o 대비 약 5배 이상 저렴하면서 논문의 2단 컬럼, 수식, 표 및 폰트 아웃라인을 완벽히 복원합니다.
 */
export async function runReplicateMarkerOcr(
  fileUrl: string,
  options?: MarkerOcrOptions
): Promise<MarkerOcrResult> {
  const apiToken = process.env.REPLICATE_API_TOKEN;

  if (!apiToken) {
    throw new Error(
      'REPLICATE_API_TOKEN 환경변수가 설정되지 않았습니다. .env.local 또는 Vercel 환경변수에서 Replicate API 토큰을 설정해 주세요. (https://replicate.com/account/api-tokens)'
    );
  }

  const replicate = new Replicate({
    auth: apiToken,
  });

  const inputConfig = {
    file: fileUrl,
    mode: options?.mode ?? 'balanced',
    force_ocr: options?.forceOcr ?? true,
    paginate: options?.paginate ?? true,
  };

  console.log('[Replicate OCR] Running datalab-to/marker with config:', {
    ...inputConfig,
    file: fileUrl.slice(0, 60) + '...',
  });

  // Replicate datalab-to/marker 실행
  const output: any = await replicate.run('datalab-to/marker', {
    input: inputConfig,
  });

  let markdownText = '';
  let metadata: Record<string, unknown> = {};

  if (typeof output === 'string') {
    // 만약 반환값이 URL인 경우 해당 파일 내용 다운로드
    if (output.startsWith('http://') || output.startsWith('https://')) {
      const res = await fetch(output);
      if (res.ok) {
        markdownText = await res.text();
      } else {
        markdownText = output;
      }
    } else {
      markdownText = output;
    }
  } else if (output && typeof output === 'object') {
    if (typeof output.markdown === 'string') {
      markdownText = output.markdown;
    } else if (typeof output.text === 'string') {
      markdownText = output.text;
    } else if (Array.isArray(output)) {
      markdownText = output.join('\n\n');
    } else {
      markdownText = JSON.stringify(output);
    }

    if (output.metadata && typeof output.metadata === 'object') {
      metadata = output.metadata;
    }
  }

  markdownText = (markdownText || '').trim();

  if (markdownText.length === 0) {
    throw new Error('Replicate OCR 처리 결과 텍스트가 비어 있습니다.');
  }

  // 페이지 분할 처리:
  // Marker 모델의 표준 페이지 구분자: {0}------------------------------------------------
  const pages: ParsedPage[] = [];
  const markerPageRegex = /\{(\d+)\}-+\s*/g;
  let match: RegExpExecArray | null;
  const indices: Array<{ pageNumber: number; startIndex: number; matchIndex: number }> = [];

  while ((match = markerPageRegex.exec(markdownText)) !== null) {
    indices.push({
      pageNumber: parseInt(match[1], 10) + 1, // Marker의 0-based 인덱스를 1-based 페이지 번호로 변환
      startIndex: match.index + match[0].length,
      matchIndex: match.index,
    });
  }

  if (indices.length > 0) {
    for (let i = 0; i < indices.length; i++) {
      const current = indices[i];
      const next = indices[i + 1];
      const text = markdownText
        .substring(current.startIndex, next ? next.matchIndex : markdownText.length)
        .trim();
      if (text.length > 0) {
        pages.push({
          pageNumber: current.pageNumber,
          text,
        });
      }
    }
  } else {
    // 대체 페이지 구분자 (\f, <!-- pagebreak --> 등)
    const rawPages = markdownText.split(/\f|<!--\s*pagebreak\s*-->/);
    if (rawPages.length > 1) {
      rawPages.forEach((pText, idx) => {
        const clean = pText.trim();
        if (clean.length > 0) {
          pages.push({
            pageNumber: idx + 1,
            text: clean,
          });
        }
      });
    }
  }

  // 페이지 구분자가 전혀 없는 경우 단일 전체 페이지로 처리
  if (pages.length === 0) {
    pages.push({
      pageNumber: 1,
      text: markdownText,
    });
  }

  return {
    markdown: markdownText,
    pages,
    metadata,
  };
}
