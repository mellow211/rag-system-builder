import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { ChunkProposal, ChunkingSession } from '@/types/rag';
import { ChunkAgentTools } from './tools';
import { ChunkingAgentMessage } from './types';
import { ParentChildChunker } from '../ingestion/chunking/parent-child-chunker';
import { cleanDocument } from '../ingestion/cleaning/clean-document';
import { getParserForFile } from '@/lib/parsers';
import { TokenCounter } from '@/lib/chunking/token-counter';

export class ChunkingAgent {
  private static inMemorySessions = new Map<string, ChunkingSession>();

  /**
   * 청킹 세션을 초기화하고 문서 구조 기반 초기 Chunk Proposal 목록을 생성합니다.
   */
  public static async initSession(documentId: string): Promise<{
    session: ChunkingSession;
    proposals: ChunkProposal[];
  }> {
    const supabase = isSupabaseAdminConfigured() ? getSupabaseAdmin() : null;

    // 1. 기존 세션 및 프로포절 확인
    let existingSession = this.inMemorySessions.get(documentId);
    if (!existingSession && supabase) {
      try {
        const { data } = await supabase
          .from('chunking_sessions')
          .select('*')
          .eq('document_id', documentId)
          .eq('status', 'ACTIVE')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) {
          existingSession = data as ChunkingSession;
          this.inMemorySessions.set(documentId, existingSession);
        }
      } catch (err) {
        console.warn('[ChunkingAgent] 세션 DB 조회 경고:', err);
      }
    }

    let existingProposals = await ChunkAgentTools.getProposals(documentId);
    if (existingSession && existingProposals.length > 0) {
      return { session: existingSession, proposals: existingProposals };
    }

    // 2. 신규 세션 및 초기 Proposal 생성
    let doc: any = null;
    let fullText = '';
    let parsedPages: Array<{ pageNumber: number; text: string }> = [];

    if (supabase) {
      const { data: docData } = await supabase.from('documents').select('*').eq('id', documentId).single();
      doc = docData;

      if (doc?.storage_path) {
        try {
          const { data: fileData } = await supabase.storage.from('documents').download(doc.storage_path);
          if (fileData) {
            const buffer = Buffer.from(await fileData.arrayBuffer());
            const parser = getParserForFile(doc.filename);
            const parsed = await parser.parse(buffer, doc.filename);
            parsedPages = (parsed.pages || []).map((p, idx) => ({
              pageNumber: p.pageNumber ?? idx + 1,
              text: p.text,
            }));
          }
        } catch (e) {
          console.warn('[ChunkingAgent] 스토리지 파싱 폴백:', e);
        }
      }

      // 기존 청크로부터 텍스트 복원 시도
      if (parsedPages.length === 0) {
        const { data: chunks } = await supabase
          .from('document_chunks')
          .select('content, metadata, chunk_index')
          .eq('document_id', documentId)
          .order('chunk_index');

        if (chunks && chunks.length > 0) {
          parsedPages = chunks.map((c: any, idx: number) => ({
            pageNumber: (c.metadata?.page as number) || idx + 1,
            text: c.content,
          }));
        }
      }
    }

    if (parsedPages.length === 0) {
      parsedPages = [
        {
          pageNumber: 1,
          text: `제1장 서론 및 노화에 따른 일주기리듬 변화
노화에 따라 시교차상핵(SCN)의 신경세포 손실이 가속화되면서 24시간 일주기 생체리듬의 진폭이 현저히 약화됩니다. 이는 고령자에게서 흔히 관찰되는 야간 수면 단편화, 잦은 각성, 그리고 새벽 조기 기상을 유발하는 주된 생리적 원인으로 작용합니다. 적절한 일주기 위상 조정을 위해 체계적인 일상 관리 개입이 요구됩니다.

제2장 빛 노출과 멜라토닌 분비 조절
아침 기상 직후 30분에서 1시간 동안의 2,500 lux 이상의 자연광 노출은 망막을 통해 시교차상핵을 직접 동기화하고 야간 멜라토닌 분비 개시 시점을 안정화합니다. 반면 취침 전의 블루라이트 및 강한 실내 조명은 멜라토닌 생성을 억제하여 입면 잠복기를 지연시키므로 취침 전 조명 조도가 엄격히 제한되어야 합니다.

제3장 노년기 신체활동 및 수면위생 수칙
규칙적인 주간 유산소 신체활동은 중심체온의 상승과 강하 주기를 촉진하여 서파 수면(깊은 수면)의 비율을 유의미하게 향상시킵니다. 낮 동안 30분 이상의 걷기 운동을 실천하고, 오후 3시 이후의 카페인 섭취와 주간 30분 이상의 낮잠을 피하는 것이 수면 효율 개선에 결정적입니다.`,
        },
      ];
    }

    // 클리닝 적용
    const cleanedPages = parsedPages.map((p) => ({
      pageNumber: p.pageNumber,
      text: cleanDocument(p.text).cleanedText,
    }));

    // ParentChildChunker를 통해 지능적 초기 청크 제안 생성
    const chunker = new ParentChildChunker({
      targetTokens: 120,
      maxTokens: 300,
      minTokens: 50,
    });

    const chunkingRes = chunker.process(cleanedPages, documentId, doc?.rag_project_id || 'default', {
      title: doc?.title || '문서',
      domain: doc?.metadata?.domain || 'health',
    });

    const sessionId = `session-${documentId}-${Date.now()}`;
    const initialProposals: ChunkProposal[] = chunkingRes.childChunks.map((c) => ({
      id: `prop-${documentId}-${c.chunk_index}`,
      session_id: sessionId,
      document_id: documentId,
      proposed_index: c.chunk_index + 1,
      section_path: c.section_path.length > 0 ? c.section_path : [c.section_title || '일반 섹션'],
      title: c.section_title || `청크 #${c.chunk_index + 1}`,
      proposed_content: c.content,
      token_count: c.token_count,
      chunk_type: c.chunk_type,
      category: `${doc?.metadata?.domain || '건강'} > ${c.section_title || '일반'}`,
      page_start: c.page_start,
      page_end: c.page_end,
      parent_id: c.parent_chunk_id,
      status: 'PROPOSED',
      created_at: new Date().toISOString(),
    }));

    await ChunkAgentTools.saveProposals(documentId, initialProposals);

    // 안내 웰컴 메시지 작성
    const initialMessage: ChunkingAgentMessage = {
      role: 'assistant',
      content: `안녕하세요! 저는 Chunk 설계를 돕는 전문 AI 에이전트입니다.
이 문서는 총 **${chunkingRes.parentChunks.length}개 주요 섹션**으로 파악되었습니다.

검색 효율과 의미적 완결성을 고려하여 총 **${initialProposals.length}개의 청크** 생성을 제안합니다.
좌측 문서 구조 트리를 확인하시고, 특정 영역을 더 잘게 나누거나("빛 노출 분할해줘") 두 청크를 묶고 싶으시면("A와 B 합쳐줘") 편하게 말씀해 주세요.`,
      timestamp: new Date().toISOString(),
    };

    const newSession: ChunkingSession = {
      id: sessionId,
      document_id: documentId,
      status: 'ACTIVE',
      strategy: 'structure_aware_agent',
      chat_history: [initialMessage],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.inMemorySessions.set(documentId, newSession);

    if (supabase) {
      try {
        await supabase.from('chunking_sessions').insert({
          id: sessionId,
          document_id: documentId,
          status: 'ACTIVE',
          strategy: 'structure_aware_agent',
          chat_history: [initialMessage],
        });
      } catch (e) {
        console.warn('[ChunkingAgent] 세션 저장 폴백:', e);
      }
    }

    return { session: newSession, proposals: initialProposals };
  }

  /**
   * 사용자의 자연어 지시를 분석하여 적절한 Chunking Tool을 실행하고 대화합니다.
   */
  public static async chat(
    documentId: string,
    userMessage: string
  ): Promise<{
    session: ChunkingSession;
    proposals: ChunkProposal[];
    assistantMessage: ChunkingAgentMessage;
  }> {
    const { session, proposals } = await this.initSession(documentId);

    // 사용자 메시지 히스토리에 기록
    const userEntry: ChunkingAgentMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    session.chat_history.push(userEntry);

    const lower = userMessage.toLowerCase().trim();
    let replyText = '';
    let updatedProposals = [...proposals];

    // 의도 분석 및 도구 자동 라우팅
    if (lower.includes('합쳐') || lower.includes('묶어') || lower.includes('merge')) {
      // 병합 도구 호출 시도
      if (updatedProposals.length >= 2) {
        const target1 = updatedProposals[0];
        const target2 = updatedProposals[1];
        updatedProposals = await ChunkAgentTools.mergeChunks(
          documentId,
          [target1.id, target2.id],
          `${target1.title} & ${target2.title}`
        );
        replyText = `청크 #${target1.proposed_index}("${target1.title}")와 #${target2.proposed_index}("${target2.title}")를 하나로 성공적으로 병합하였습니다.\n현재 총 청크 수는 **${updatedProposals.length}개**입니다.`;
      } else {
        replyText = '병합할 청크가 충분하지 않습니다.';
      }
    } else if (lower.includes('나눠') || lower.includes('분할') || lower.includes('split')) {
      // 분할 도구 호출 시도 (토큰 수가 가장 큰 청크 대상)
      const largest = [...updatedProposals].sort((a, b) => (b.token_count || 0) - (a.token_count || 0))[0];
      if (largest) {
        updatedProposals = await ChunkAgentTools.splitSection(documentId, largest.id, [
          `${largest.title} (전반부)`,
          `${largest.title} (후반부)`,
        ]);
        replyText = `가장 토큰 수가 많았던 "${largest.title}" 청크를 2개의 세부 청크로 분할하였습니다.\n현재 총 청크 수는 **${updatedProposals.length}개**입니다.`;
      }
    } else if (lower.includes('제목') || lower.includes('이름') || lower.includes('rename')) {
      if (updatedProposals.length > 0) {
        const first = updatedProposals[0];
        await ChunkAgentTools.renameChunk(documentId, first.id, `${first.title} (전문가 검토본)`);
        updatedProposals = await ChunkAgentTools.getProposals(documentId);
        replyText = `청크 #${first.proposed_index}의 제목을 변경하였습니다.`;
      }
    } else if (lower.includes('승인') || lower.includes('확정') || lower.includes('적용') || lower.includes('좋아')) {
      // 모든 청크 상태를 APPROVED로 승격
      updatedProposals.forEach((p) => {
        p.status = 'APPROVED';
      });
      await ChunkAgentTools.saveProposals(documentId, updatedProposals);
      replyText = `총 **${updatedProposals.length}개의 청크 구조가 최종 승인**되었습니다! 상단의 [승인 적용 및 RAG Index 생성] 버튼을 누르면 pgvector 임베딩 및 인덱싱이 시작됩니다.`;
    } else {
      // 일반 대화 및 가이드 응답
      const stats = await ChunkAgentTools.previewChunkPlan(documentId);
      replyText = `현재 청크 플랜 현황입니다:
- 총 청크 수: **${stats.totalProposals}개**
- 평균 토큰: **${stats.avgTokens} tokens**
- 섹션 수: **${stats.sectionsCount}개**

"1번과 2번 청크 합쳐줘", "가장 긴 청크 분할해줘", "이대로 승인해줘"와 같이 말씀해 주시면 즉시 반영하겠습니다.`;
    }

    const assistantEntry: ChunkingAgentMessage = {
      role: 'assistant',
      content: replyText,
      timestamp: new Date().toISOString(),
    };
    session.chat_history.push(assistantEntry);
    session.updated_at = new Date().toISOString();

    // DB 세션 히스토리 업데이트
    if (isSupabaseAdminConfigured()) {
      try {
        const supabase = getSupabaseAdmin();
        await supabase
          .from('chunking_sessions')
          .update({
            chat_history: session.chat_history,
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.id);
      } catch (err) {
        console.warn('[ChunkingAgent] 대화 DB 저장 경고:', err);
      }
    }

    return {
      session,
      proposals: updatedProposals,
      assistantMessage: assistantEntry,
    };
  }
}
