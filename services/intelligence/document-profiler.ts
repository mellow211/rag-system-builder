import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getParserForFile } from '@/lib/parsers';
import { cleanDocument } from '@/services/ingestion/cleaning/clean-document';
import { getLLMProvider } from '@/services/llm';
import { DocumentProfile, DomainType } from '@/types/rag';
import {
  DOCUMENT_PROFILE_PROMPT_VERSION,
  DOCUMENT_PROFILE_SYSTEM_PROMPT,
  buildDocumentProfileUserPrompt,
  DOCUMENT_PROFILE_JSON_SCHEMA,
} from './prompts/document-profile';
import { ProfileCache } from './profile-cache';

export class DocumentProfiler {
  private static inMemoryProfiles = new Map<string, DocumentProfile>();

  /**
   * 문서 원본 텍스트를 추출하여 LLM 기반 구조화 Document Profile을 생성합니다.
   */
  public static async analyzeDocument(
    documentId: string,
    options?: { forceReanalyze?: boolean; fileBuffer?: Buffer }
  ): Promise<DocumentProfile> {
    const supabase = isSupabaseAdminConfigured() ? getSupabaseAdmin() : null;

    let doc: any = null;
    if (supabase) {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (error || !data) {
        throw new Error(`문서를 찾을 수 없습니다: ${documentId}`);
      }
      doc = data;
    } else {
      doc = {
        id: documentId,
        title: '고령자의 수면과 일주기리듬 가이드라인',
        filename: 'circadian_sleep.pdf',
        rag_project_id: 'circadian',
        document_type: '가이드라인',
        metadata: { domain: 'circadian' },
      };
    }

    // 문서 상태를 ANALYZING으로 변경
    if (supabase) {
      await supabase
        .from('documents')
        .update({ status: 'ANALYZING', error_message: null })
        .eq('id', documentId);
    }

    const provider = getLLMProvider();
    const cacheKey = ProfileCache.computeKey(
      documentId,
      'document_profile',
      DOCUMENT_PROFILE_PROMPT_VERSION,
      provider.defaultModel
    );

    // 1. 강제 재분석이 아니면 기존 저장된 프로파일이나 캐시 확인
    if (!options?.forceReanalyze) {
      const cached = await ProfileCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      if (supabase) {
        const { data: existingProfile } = await supabase
          .from('document_profiles')
          .select('*')
          .eq('document_id', documentId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingProfile) {
          const formatted = this.formatDbProfile(existingProfile);
          ProfileCache.set(
            cacheKey,
            documentId,
            'document_profile',
            DOCUMENT_PROFILE_PROMPT_VERSION,
            provider.defaultModel,
            formatted
          );
          return formatted;
        }
      } else if (this.inMemoryProfiles.has(documentId)) {
        return this.inMemoryProfiles.get(documentId)!;
      }
    }

    // 2. 문서 텍스트 발췌본 확보
    let fullText = '';
    try {
      let buffer = options?.fileBuffer;
      if (!buffer && doc.storage_path && supabase) {
        const { data: fileData, error: downloadErr } = await supabase.storage
          .from('documents')
          .download(doc.storage_path);

        if (!downloadErr && fileData) {
          buffer = Buffer.from(await fileData.arrayBuffer());
        }
      }

      if (buffer) {
        const parser = getParserForFile(doc.filename || 'document.pdf');
        const parsed = await parser.parse(buffer, doc.filename || 'document.pdf');
        fullText = parsed.totalText || '';
      }
    } catch (parseErr) {
      console.warn('[DocumentProfiler] 파일 원본 파싱 실패, 청크 데이터 확인:', parseErr);
    }

    // 청크가 이미 존재하는 경우 텍스트 복원
    if (!fullText && supabase) {
      const { data: chunks } = await supabase
        .from('document_chunks')
        .select('content')
        .eq('document_id', documentId)
        .order('chunk_index')
        .limit(10);

      if (chunks && chunks.length > 0) {
        fullText = chunks.map((c: any) => c.content).join('\n\n');
      }
    }

    if (!fullText) {
      fullText = `문서 제목: ${doc.title}\n출처: ${doc.source || doc.publisher || '미상'}\n고령자 건강정보 및 일상생활 지침`;
    }

    // 클리닝 적용 및 앞부분 3,500자 추출 (LLM 분석용 최적 샘플)
    const cleanedSample = cleanDocument(fullText).cleanedText.slice(0, 3500);

    // 3. LLM 분석 실행
    const domain = (doc.metadata?.domain as DomainType) || (doc.rag_project_id as DomainType) || 'health';
    const userPrompt = buildDocumentProfileUserPrompt({
      title: doc.title,
      domain,
      source: doc.source,
      publisher: doc.publisher,
      documentType: doc.document_type,
      contentSample: cleanedSample,
    });

    let generatedProfile: DocumentProfile;
    try {
      generatedProfile = await provider.generateStructured<DocumentProfile>({
        systemPrompt: DOCUMENT_PROFILE_SYSTEM_PROMPT,
        prompt: userPrompt,
        schemaName: 'DocumentProfile',
        schema: DOCUMENT_PROFILE_JSON_SCHEMA,
        temperature: 0.1,
        maxTokens: 2500,
      });
    } catch (llmErr) {
      console.error('[DocumentProfiler] LLM 호출 실패, 휴리스틱 생성기로 폴백:', llmErr);
      const fallbackProvider = getLLMProvider('mock');
      generatedProfile = await fallbackProvider.generateStructured<DocumentProfile>({
        systemPrompt: DOCUMENT_PROFILE_SYSTEM_PROMPT,
        prompt: userPrompt,
        schemaName: 'DocumentProfile',
        schema: DOCUMENT_PROFILE_JSON_SCHEMA,
      });
    }

    // 메타데이터 정규화
    const finalProfile: DocumentProfile = {
      ...generatedProfile,
      document_id: documentId,
      domain: generatedProfile.domain || domain,
      prompt_version: DOCUMENT_PROFILE_PROMPT_VERSION,
      profile_version: 'v1',
      llm_model: provider.defaultModel,
      status: 'PROPOSED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 4. DB 및 캐시 저장
    this.inMemoryProfiles.set(documentId, finalProfile);
    await ProfileCache.set(
      cacheKey,
      documentId,
      'document_profile',
      DOCUMENT_PROFILE_PROMPT_VERSION,
      provider.defaultModel,
      finalProfile
    );

    if (supabase) {
      try {
        await supabase.from('document_profiles').upsert(
          {
            document_id: documentId,
            domain: finalProfile.domain,
            document_type: finalProfile.document_type,
            summary_short: finalProfile.summary_short,
            summary_full: finalProfile.summary_full,
            topics: finalProfile.topics,
            concepts: finalProfile.concepts,
            keywords: finalProfile.keywords,
            target_population: finalProfile.target_population,
            diseases: finalProfile.diseases,
            health_metrics: finalProfile.health_metrics,
            lifestyle_factors: finalProfile.lifestyle_factors,
            categories: finalProfile.categories,
            structure: finalProfile.structure,
            candidate_entities: finalProfile.candidate_entities || [],
            cross_domain_connections: finalProfile.cross_domain_connections || [],
            llm_model: finalProfile.llm_model,
            prompt_version: finalProfile.prompt_version,
            profile_version: finalProfile.profile_version,
            status: finalProfile.status,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'document_id,profile_version' }
        );

        // 문서 상태를 PROFILE_REVIEW로 갱신 (사용자가 확인/수정/확정할 수 있는 대기 상태)
        await supabase
          .from('documents')
          .update({
            status: 'PROFILE_REVIEW',
            profile_version: 'v1',
            updated_at: new Date().toISOString(),
          })
          .eq('id', documentId);
      } catch (dbErr) {
        console.warn('[DocumentProfiler] DB 저장 경고 (인메모리 유지):', dbErr);
      }
    }

    return finalProfile;
  }

  /**
   * 문서의 최신 Document Profile을 조회합니다.
   */
  public static async getProfile(documentId: string): Promise<DocumentProfile | null> {
    if (this.inMemoryProfiles.has(documentId)) {
      return this.inMemoryProfiles.get(documentId)!;
    }

    if (isSupabaseAdminConfigured()) {
      try {
        const supabase = getSupabaseAdmin();
        const { data } = await supabase
          .from('document_profiles')
          .select('*')
          .eq('document_id', documentId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) {
          const profile = this.formatDbProfile(data);
          this.inMemoryProfiles.set(documentId, profile);
          return profile;
        }
      } catch (err) {
        console.warn('[DocumentProfiler] 프로파일 DB 조회 오류:', err);
      }
    }

    return null;
  }

  /**
   * 사용자가 수정한 Profile을 저장하고, 승인(Approve) 시 문서 상태를 다음 단계(CHUNKING)로 승격합니다.
   */
  public static async updateProfile(
    documentId: string,
    updatedData: Partial<DocumentProfile>,
    approve: boolean = false
  ): Promise<DocumentProfile> {
    const existing = (await this.getProfile(documentId)) || {
      document_id: documentId,
      domain: 'health',
      document_type: '기타',
      summary_short: '',
      summary_full: '',
      topics: [],
      concepts: [],
      keywords: [],
      target_population: [],
      diseases: [],
      health_metrics: [],
      lifestyle_factors: [],
      categories: [],
      structure: [],
      prompt_version: DOCUMENT_PROFILE_PROMPT_VERSION,
      profile_version: 'v1',
      status: 'PROPOSED',
    };

    const newStatus = approve ? 'APPROVED' : 'EDITED';
    const merged: DocumentProfile = {
      ...existing,
      ...updatedData,
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    this.inMemoryProfiles.set(documentId, merged);

    if (isSupabaseAdminConfigured()) {
      try {
        const supabase = getSupabaseAdmin();
        await supabase.from('document_profiles').upsert(
          {
            document_id: documentId,
            domain: merged.domain,
            document_type: merged.document_type,
            summary_short: merged.summary_short,
            summary_full: merged.summary_full,
            topics: merged.topics,
            concepts: merged.concepts,
            keywords: merged.keywords,
            target_population: merged.target_population,
            diseases: merged.diseases,
            health_metrics: merged.health_metrics,
            lifestyle_factors: merged.lifestyle_factors,
            categories: merged.categories,
            structure: merged.structure,
            candidate_entities: merged.candidate_entities || [],
            cross_domain_connections: merged.cross_domain_connections || [],
            status: newStatus,
            profile_version: merged.profile_version || 'v1',
            prompt_version: merged.prompt_version,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'document_id,profile_version' }
        );

        // 사용자가 확정(Approve)한 경우 문서 상태를 CHUNKING 단계로 승격
        if (approve) {
          await supabase
            .from('documents')
            .update({
              status: 'CHUNKING',
              updated_at: new Date().toISOString(),
            })
            .eq('id', documentId);
        }
      } catch (err) {
        console.warn('[DocumentProfiler] DB 프로파일 갱신 경고:', err);
      }
    }

    return merged;
  }

  private static formatDbProfile(dbRow: any): DocumentProfile {
    return {
      id: dbRow.id,
      document_id: dbRow.document_id,
      domain: dbRow.domain,
      document_type: dbRow.document_type,
      summary_short: dbRow.summary_short,
      summary_full: dbRow.summary_full,
      topics: Array.isArray(dbRow.topics) ? dbRow.topics : [],
      concepts: Array.isArray(dbRow.concepts) ? dbRow.concepts : [],
      keywords: Array.isArray(dbRow.keywords) ? dbRow.keywords : [],
      target_population: Array.isArray(dbRow.target_population) ? dbRow.target_population : [],
      diseases: Array.isArray(dbRow.diseases) ? dbRow.diseases : [],
      health_metrics: Array.isArray(dbRow.health_metrics) ? dbRow.health_metrics : [],
      lifestyle_factors: Array.isArray(dbRow.lifestyle_factors) ? dbRow.lifestyle_factors : [],
      categories: Array.isArray(dbRow.categories) ? dbRow.categories : [],
      structure: Array.isArray(dbRow.structure) ? dbRow.structure : [],
      candidate_entities: Array.isArray(dbRow.candidate_entities) ? dbRow.candidate_entities : [],
      cross_domain_connections: Array.isArray(dbRow.cross_domain_connections)
        ? dbRow.cross_domain_connections
        : [],
      llm_model: dbRow.llm_model,
      prompt_version: dbRow.prompt_version,
      profile_version: dbRow.profile_version || 'v1',
      status: dbRow.status || 'PROPOSED',
      created_at: dbRow.created_at,
      updated_at: dbRow.updated_at,
    };
  }
}
