export interface EmbeddingContentParams {
  documentTitle: string;
  domain: string;
  sectionPath: string[];
  contextText?: string;
  content: string;
}

export class EmbeddingContentBuilder {
  /**
   * Vector DB 검색용 컨텍스트 주입 텍스트를 구성합니다.
   * [Document] -> [Domain] -> [Section] -> [Context] -> [Content]
   */
  public static build(params: EmbeddingContentParams): string {
    const { documentTitle, domain, sectionPath, contextText, content } = params;

    const secStr = sectionPath && sectionPath.length > 0 ? sectionPath.join(' > ') : '일반 본문';

    const parts: string[] = [
      `[Document]\n${documentTitle.trim()}`,
      `[Domain]\n${domain.trim()}`,
      `[Section]\n${secStr.trim()}`,
    ];

    if (contextText && contextText.trim()) {
      parts.push(`[Context]\n${contextText.trim()}`);
    }

    parts.push(`[Content]\n${content.trim()}`);

    return parts.join('\n\n');
  }

  /**
   * 사용자 화면 표출 및 Citation을 위해 embedding_content에서 순수 [Content]만 안전하게 분리
   */
  public static extractPureContent(embeddingContent: string): string {
    if (!embeddingContent.includes('[Content]')) {
      return embeddingContent;
    }
    const parts = embeddingContent.split('[Content]\n');
    return parts[parts.length - 1].trim();
  }
}
