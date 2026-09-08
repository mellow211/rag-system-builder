import { DocumentParser, ParseResult } from './base';

export class MdParser implements DocumentParser {
  readonly supportedExtensions = ['.md', '.markdown'];

  async parse(buffer: Buffer, filename: string): Promise<ParseResult> {
    const text = buffer.toString('utf-8');

    // 마크다운의 경우 대단원(# H1) 또는 슬라이드 구분(---)을 기준으로 논리적 페이지 분할 가능
    // 기본적으로 단일 페이지로 취급하되 구조적 메타데이터 보존
    return {
      pages: [
        {
          pageNumber: 1,
          text,
        },
      ],
      totalText: text,
      metadata: {
        filename,
        format: 'markdown',
        length: text.length,
      },
    };
  }
}
