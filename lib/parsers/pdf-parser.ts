import { DocumentParser, ParseResult, ParsedPage } from './base';

export class PdfParser implements DocumentParser {
  readonly supportedExtensions = ['.pdf'];

  async parse(buffer: Buffer, filename: string): Promise<ParseResult> {
    // CommonJS / ESM 환경 호환 동적 로딩
    const pdfParseModule: any = await import('pdf-parse');
    const pdfParse = typeof pdfParseModule === 'function' ? pdfParseModule : (pdfParseModule.default || pdfParseModule);

    const pages: ParsedPage[] = [];

    // 페이지별 텍스트 렌더링 콜백
    const pagerender = (pageData: any) => {
      return pageData.getTextContent().then((textContent: any) => {
        let lastY: number | null = null;
        let text = '';
        for (const item of textContent.items) {
          if (lastY === item.transform[5] || !lastY) {
            text += item.str;
          } else {
            text += '\n' + item.str;
          }
          lastY = item.transform[5];
        }

        pages.push({
          pageNumber: pageData.pageIndex + 1,
          text: text.trim(),
        });

        return text;
      });
    };

    const data = await pdfParse(buffer, { pagerender });

    return {
      pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: data.text }],
      totalText: data.text,
      metadata: {
        filename,
        format: 'pdf',
        totalPages: data.numpages,
        info: data.info,
      },
    };
  }
}
