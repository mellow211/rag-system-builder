import { EmbeddingProvider } from './base';

/**
 * 개발/테스트용 Mock 임베딩 프로바이더
 * 외부 API 키 없이도 결정론적 1536차원 정규화 벡터를 생성하여
 * Supabase pgvector HNSW 인덱스 및 코사인 검색을 안전하게 테스트할 수 있습니다.
 */
export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly providerName = 'mock';
  readonly modelName = 'mock-1536-normalized';
  readonly dimension = 1536;

  async embedText(text: string): Promise<number[]> {
    return this.generateDeterministicVector(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.generateDeterministicVector(t));
  }

  private generateDeterministicVector(text: string): number[] {
    const vector = new Array<number>(this.dimension);
    
    // 단순 문자열 해시 생성
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }

    let sumSquares = 0;
    for (let i = 0; i < this.dimension; i++) {
      // 의사 난수 생성 (xorshift 유사 방식)
      const x = Math.sin(hash + i * 13.37) * 10000;
      const val = x - Math.floor(x);
      const centered = val * 2 - 1; // -1.0 ~ 1.0
      vector[i] = centered;
      sumSquares += centered * centered;
    }

    // L2 단위 벡터 정규화 (코사인 유사도 검색 정확도 보장)
    const norm = Math.sqrt(sumSquares) || 1;
    for (let i = 0; i < this.dimension; i++) {
      vector[i] = parseFloat((vector[i] / norm).toFixed(6));
    }

    return vector;
  }
}
