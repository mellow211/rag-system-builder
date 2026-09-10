export type BlockType =
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'table'
  | 'qa'
  | 'definition'
  | 'guideline';

export interface DocumentBlock {
  type: BlockType;
  text: string;
  level?: number; // 1 = h1, 2 = h2, 3 = h3, 4 = h4
  pageNumber: number;
  confidence?: number; // 0.0 ~ 1.0 (heading confidence 등)
  metadata?: Record<string, unknown>;
}

export interface ParsedPageStructure {
  pageNumber: number;
  blocks: DocumentBlock[];
}

export interface ParsedDocumentStructure {
  documentId: string;
  title: string;
  domain: string;
  pages: ParsedPageStructure[];
  totalText: string;
  metadata?: Record<string, unknown>;
}

export interface HeadingCandidate {
  text: string;
  level: number;
  confidence: number;
  patternType: string;
}
