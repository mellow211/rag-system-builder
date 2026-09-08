export interface EmbeddingProvider {
  readonly providerName: string;
  readonly modelName: string;
  readonly dimension: number;

  /**
   * 단일 텍스트를 임베딩 벡터로 변환
   */
  embedText(text: string): Promise<number[]>;

  /**
   * 텍스트 배열을 배치 단위로 임베딩 벡터로 변환
   */
  embedBatch(texts: string[]): Promise<number[][]>;
}
