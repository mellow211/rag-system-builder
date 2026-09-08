export interface ParsedPage {
  pageNumber?: number;
  text: string;
}

export interface ParseResult {
  pages: ParsedPage[];
  totalText: string;
  metadata?: Record<string, unknown>;
}

export interface DocumentParser {
  readonly supportedExtensions: string[];
  parse(buffer: Buffer, filename: string): Promise<ParseResult>;
}
