import { DocumentParser } from './base';
import { PdfParser } from './pdf-parser';
import { TxtParser } from './txt-parser';
import { MdParser } from './md-parser';

export * from './base';
export * from './pdf-parser';
export * from './txt-parser';
export * from './md-parser';

const parsers: DocumentParser[] = [
  new PdfParser(),
  new TxtParser(),
  new MdParser(),
];

/**
 * 파일명 또는 확장자에 알맞은 DocumentParser 인스턴스를 반환합니다.
 */
export function getParserForFile(filename: string): DocumentParser {
  const ext = '.' + filename.split('.').pop()?.toLowerCase();
  const parser = parsers.find((p) => p.supportedExtensions.includes(ext));

  if (!parser) {
    throw new Error(`지원하지 않는 파일 형식입니다 (${ext}). 지원 형식: PDF, TXT, MD`);
  }

  return parser;
}
