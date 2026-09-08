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

    // 방법 1: unpdf getDocumentProxy 기반 안정적 파싱
    try {
      const { extractText, getDocumentProxy } = await import('unpdf');
      const uint8Array = new Uint8Array(buffer);
      const doc = await getDocumentProxy(uint8Array);
      const totalPages = doc.numPages;
      const { text } = await extractText(doc, { mergePages: false });

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

        // 스캔본 / 폰트 아웃라인(곡선 벡터화) PDF 감지 검증
        const koreanCount = (fullText.match(/[가-힣]/g) || []).length;
        const alphaCount = (fullText.match(/[a-zA-Z]/g) || []).length;
        const readableChars = koreanCount + alphaCount;

        // 2페이지 이상의 문서인데 유효 글자(한글+영문)가 50자 미만인 경우 스캔본/아웃라인으로 판정
        if (totalPages >= 2 && readableChars < 50) {
          throw new Error(
            `이 PDF는 본문 텍스트 레이어가 없는 '스캔 이미지' 또는 '폰트 윤곽선(아웃라인) 변환' 문서입니다. (추출된 텍스트 0자 / 총 ${totalPages}페이지). 원활한 RAG 검색을 위해 OCR(문자 인식)이 적용된 PDF나 원문 텍스트 파일을 등록해 주세요.`
          );
        }

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
    } catch (unpdfErr: any) {
      // 스캔/아웃라인 에러 메시지는 그대로 상위로 전달하여 사용자에게 명확히 안내
      if (unpdfErr?.message?.includes('스캔 이미지')) {
        throw unpdfErr;
      }
      console.warn('unpdf 파싱 실패, fallback 시도:', unpdfErr);
    }

    // 방법 2: pdf-parse fallback
    try {
      const pdfParseModule: any = await import('pdf-parse');
      const pdfParse = typeof pdfParseModule === 'function' ? pdfParseModule : (pdfParseModule.default || pdfParseModule);

      const data = await pdfParse(buffer);
      const text = (data.text || '').trim();

      const koreanCount = (text.match(/[가-힣]/g) || []).length;
      const alphaCount = (text.match(/[a-zA-Z]/g) || []).length;

      if ((data.numpages || 1) >= 2 && (koreanCount + alphaCount) < 50) {
        throw new Error(
          `이 PDF는 본문 텍스트 레이어가 없는 '스캔 이미지' 또는 '폰트 윤곽선(아웃라인) 변환' 문서입니다. OCR(문자 인식)이 적용된 PDF나 원문 텍스트 파일을 등록해 주세요.`
        );
      }

      return {
        pages: [{ pageNumber: 1, text }],
        totalText: text,
        metadata: {
          filename,
          format: 'pdf',
          totalPages: data.numpages || 1,
        },
      };
    } catch (pdfParseErr: any) {
      if (pdfParseErr?.message?.includes('스캔 이미지')) {
        throw pdfParseErr;
      }
      console.warn('pdf-parse 실패:', pdfParseErr);
    }

    throw new Error(
      'PDF 문서에서 텍스트를 추출할 수 없습니다. 스캔 이미지나 보호된 문서일 수 있으므로 OCR 변환 후 재시도해 주세요.'
    );
  }
}
