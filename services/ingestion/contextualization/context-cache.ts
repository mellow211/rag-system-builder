import crypto from 'crypto';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../../../lib/supabase/admin';

export class ContextCache {
  private static inMemoryCache = new Map<string, string>();

  /**
   * 고유 청크 해시 생성 (문서ID, 섹션경로, 원문, 프롬프트버전 결합)
   */
  public static computeHash(
    documentId: string,
    sectionPath: string[],
    content: string,
    promptVersion: string
  ): string {
    const raw = `${documentId}|${sectionPath.join('/')}|${content.trim()}|${promptVersion}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * 캐시된 문맥 설명 조회
   */
  public static async get(hash: string): Promise<string | null> {
    // 1. 인메모리 캐시 확인
    if (this.inMemoryCache.has(hash)) {
      return this.inMemoryCache.get(hash)!;
    }

    // 2. Supabase DB 캐시 확인 (구성된 경우)
    if (isSupabaseAdminConfigured()) {
      try {
        const supabase = getSupabaseAdmin();
        const { data } = await supabase
          .from('chunk_context_cache')
          .select('context_text')
          .eq('chunk_hash', hash)
          .maybeSingle();

        if (data?.context_text) {
          this.inMemoryCache.set(hash, data.context_text);
          return data.context_text;
        }
      } catch {
        // 테이블 부재 또는 네트워크 오류 시 인메모리로 무장애 처리
      }
    }

    return null;
  }

  /**
   * 캐시에 문맥 설명 저장
   */
  public static async set(
    hash: string,
    documentId: string,
    contextText: string,
    contextModel: string,
    promptVersion: string
  ): Promise<void> {
    this.inMemoryCache.set(hash, contextText);

    if (isSupabaseAdminConfigured()) {
      try {
        const supabase = getSupabaseAdmin();
        await supabase
          .from('chunk_context_cache')
          .upsert(
            {
              chunk_hash: hash,
              document_id: documentId,
              context_text: contextText,
              context_model: contextModel,
              prompt_version: promptVersion,
            },
            { onConflict: 'chunk_hash' }
          );
      } catch {
        // DB 쓰기 실패 시에도 인메모리는 유지
      }
    }
  }
}
