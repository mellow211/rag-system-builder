import { DocumentParser, ParseResult } from './base';

export class TxtParser implements DocumentParser {
  readonly supportedExtensions = ['.txt'];

  async parse(buffer: Buffer, filename: string): Promise<ParseResult> {
    const text = buffer.toString('utf-8');
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
        format: 'txt',
        length: text.length,
      },
    };
  }
}
