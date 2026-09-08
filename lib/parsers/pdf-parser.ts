import { DocumentParser, ParseResult, ParsedPage } from './base';

// 1. Node.js / Vercel Serverless 환경용 DOMMatrix 폴리필
if (typeof (globalThis as any).DOMMatrix === 'undefined') {
  (globalThis as any).DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    m11 = 1; m12 = 0; m21 = 0; m22 = 1; m41 = 0; m42 = 0;
    constructor(init?: any) {
      if (Array.isArray(init)) {
        this.a = init[0] ?? 1;
        this.b = init[1] ?? 0;
        this.c = init[2] ?? 0;
        this.d = init[3] ?? 1;
        this.e = init[4] ?? 0;
        this.f = init[5] ?? 0;
      }
    }
    multiply() { return this; }
    translate() { return this; }
    scale() { return this; }
    transformPoint(p: any) { return p; }
  };
}

export class PdfParser implements DocumentParser {
  readonly supportedExtensions = ['.pdf'];

  async parse(buffer: Buffer, filename: string): Promise<ParseResult> {
    const pages: ParsedPage[] = [];

    // 방법 1: 서버리스/Edge 환경에 최적화된 unpdf 사용 (DOMMatrix 에러 원천 차단)
    try {
      const { extractText } = await import('unpdf');
      const uint8Array = new Uint8Array(buffer);
      const { totalPages, text } = await extractText(uint8Array);

      if (Array.isArray(text) && text.length > 0) {
        text.forEach((pageText, idx) => {
          const cleanPage = (pageText || '').trim();
          if (cleanPage.length > 0) {
            pages.push({
              pageNumber: idx + 1,
              text: cleanPage,
            });
          }
        });

        const fullText = pages.map((p) => p.text).join('\n\n');

        if (fullText.trim().length > 0) {
          return {
            pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: fullText }],
            totalText: fullText,
            metadata: {
              filename,
              format: 'pdf',
              totalPages: totalPages || pages.length,
            },
          };
        }
      }
    } catch (unpdfErr) {
      console.warn('unpdf 파싱 실패, pdf-parse fallback 시도:', unpdfErr);
    }

    // 방법 2: pdf-parse fallback
    try {
      const pdfParseModule: any = await import('pdf-parse');
      const pdfParse = typeof pdfParseModule === 'function' ? pdfParseModule : (pdfParseModule.default || pdfParseModule);

      const data = await pdfParse(buffer);
      const text = (data.text || '').trim();

      return {
        pages: [{ pageNumber: 1, text }],
        totalText: text,
        metadata: {
          filename,
          format: 'pdf',
          totalPages: data.numpages || 1,
        },
      };
    } catch (pdfParseErr) {
      console.warn('pdf-parse 파싱 실패, regex 스트림 fallback 시도:', pdfParseErr);
    }

    // 방법 3: 순수 정규식 텍스트 스트림 추출 (최후의 안전장치)
    const rawString = buffer.toString('binary');
    const textMatches = rawString.match(/\(([^()]+)\)Tj/g) || [];
    const extractedWords = textMatches
      .map((m) => m.replace(/^$$|$$Tj$/g, ''))
      .filter((w) => w.trim().length > 0);

    const fallbackText = extractedWords.join(' ').trim();

    return {
      pages: [{ pageNumber: 1, text: fallbackText }],
      totalText: fallbackText,
      metadata: {
        filename,
        format: 'pdf',
        totalPages: 1,
        fallback: true,
      },
    };
  }
}
