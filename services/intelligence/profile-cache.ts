import crypto from 'crypto';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { DocumentProfile } from '@/types/rag';

export class ProfileCache {
  private static inMemory = new Map<string, DocumentProfile>();

  /**
   * 고유 캐시 키 생성 (문서ID/해시 + 단계 + 프롬프트 버전 + 모델명)
   */
  public static computeKey(
    documentId: string,
    step: string,
    promptVersion: string,
    modelName: string
  ): string {
    const raw = `${documentId}:${step}:${promptVersion}:${modelName}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  public static async get(cacheKey: string): Promise<DocumentProfile | null> {
    if (this.inMemory.has(cacheKey)) {
      return this.inMemory.get(cacheKey)!;
    }

    if (isSupabaseAdminConfigured()) {
      try {
        const supabase = getSupabaseAdmin();
        const { data } = await supabase
          .from('llm_execution_cache')
          .select('response_json')
          .eq('cache_key', cacheKey)
          .maybeSingle();

        if (data?.response_json) {
          const profile = data.response_json as DocumentProfile;
          this.inMemory.set(cacheKey, profile);
          return profile;
        }
      } catch {
        // DB 테이블 미생성 환경 시 무장애 fallback
      }
    }

    return null;
  }

  public static async set(
    cacheKey: string,
    documentId: string,
    step: string,
    promptVersion: string,
    modelName: string,
    profile: DocumentProfile
  ): Promise<void> {
    this.inMemory.set(cacheKey, profile);

    if (isSupabaseAdminConfigured()) {
      try {
        const supabase = getSupabaseAdmin();
        await supabase
          .from('llm_execution_cache')
          .upsert(
            {
              cache_key: cacheKey,
              document_id: documentId,
              step,
              prompt_version: promptVersion,
              model: modelName,
              response_json: profile,
            },
            { onConflict: 'cache_key' }
          );
      } catch {
        // 무장애 fallback
      }
    }
  }
}
