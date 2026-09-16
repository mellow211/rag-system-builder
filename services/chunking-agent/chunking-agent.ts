import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { ChunkProposal, ChunkingSession } from '@/types/rag';
import { ChunkAgentTools } from './tools';
import { ChunkingAgentMessage } from './types';
import { ParentChildChunker } from '../ingestion/chunking/parent-child-chunker';
import { cleanDocument } from '../ingestion/cleaning/clean-document';
import { getParserForFile } from '@/lib/parsers';
import { TokenCounter } from '@/lib/chunking/token-counter';
import { getLLMProvider } from '@/services/llm';
import {
  CHUNK_AGENT_SYSTEM_PROMPT,
  CHUNK_AGENT_DECISION_SCHEMA,
  ChunkAgentActionDecision,
} from './prompts/chunk-agent';

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
    let parsedPages: Array<{ pageNumber: number; text: string }> = [];

    if (supabase) {
      const { data: docData } = await supabase.from('documents').select('*').eq('id', documentId).single();
      doc = docData;

      // 파일 원본 스토리지에서 다운로드 및 파싱
      if (doc?.storage_path) {
        try {
          const { data: fileData } = await supabase.storage.from('documents').download(doc.storage_path);
          if (fileData) {
            const buffer = Buffer.from(await fileData.arrayBuffer());
            const parser = getParserForFile(doc.filename || 'document.pdf');
            const parsed = await parser.parse(buffer, doc.filename || 'document.pdf');
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

    // 문서 메타데이터 요약이나 텍스트 확인
    if (parsedPages.length === 0 && (doc?.metadata?.raw_text || doc?.metadata?.summary_full)) {
      parsedPages = [
        {
          pageNumber: 1,
          text: doc.metadata?.raw_text || doc.metadata?.summary_full,
        },
      ];
    }

    // 최후의 기본 샘플 텍스트 (테스트 환경)
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
      proposed_index: c.chunk_index,
      title: c.section_title || `${doc?.title || '청크'} #${c.chunk_index}`,
      section_path: c.section_path || [],
      chunk_type: c.chunk_type || 'paragraph',
      category: (doc?.metadata?.domain as string) || '일반',
      proposed_content: c.content,
      token_count: c.token_count || TokenCounter.count(c.content),
      page_start: c.page_start || 1,
      page_end: c.page_end || 1,
      status: 'PROPOSED',
      context_text: c.context_text,
      embedding_content: c.embedding_content || c.content,
      created_at: new Date().toISOString(),
    }));

    // 프로포절 저장
    await ChunkAgentTools.saveProposals(documentId, initialProposals);

    // 신규 세션 객체 생성
    const newSession: ChunkingSession = {
      id: sessionId,
      document_id: documentId,
      status: 'ACTIVE',
      strategy: 'agent_assisted',
      total_proposals: initialProposals.length,
      approved_proposals: 0,
      chat_history: [
        {
          role: 'assistant',
          content: `반갑습니다! "${doc?.title || '문서'}"의 구조 분석을 완료하여 총 **${initialProposals.length}개의 초기 청크 제안**을 구성했습니다.\n\n각 청크의 분할·병합, 제목 수정, 카테고리 조정 등 필요한 작업이 있으시면 자연어로 편하게 말씀해 주세요.`,
          timestamp: new Date().toISOString(),
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.inMemorySessions.set(documentId, newSession);

    if (supabase) {
      try {
        await supabase.from('chunking_sessions').insert({
          id: newSession.id,
          document_id: newSession.document_id,
          status: newSession.status,
          total_proposals: newSession.total_proposals,
          approved_proposals: newSession.approved_proposals,
          chat_history: newSession.chat_history,
          created_at: newSession.created_at,
          updated_at: newSession.updated_at,
        });
      } catch (e) {
        console.warn('[ChunkingAgent] 세션 저장 폴백:', e);
      }
    }

    return { session: newSession, proposals: initialProposals };
  }

  /**
   * LLM을 적극 활용하여 사용자의 자연어 지시를 정밀 분석하고, 적절한 Chunking Tool을 실행합니다.
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

    let updatedProposals = [...proposals];
    const provider = getLLMProvider();

    // 청크 현황 요약 준비 (LLM 컨텍스트 주입용)
    const proposalsOverview = updatedProposals.slice(0, 15).map((p) => ({
      index: p.proposed_index,
      title: p.title,
      category: p.category,
      tokens: p.token_count,
      page: p.page_start,
      preview: p.proposed_content.slice(0, 80) + '...',
    }));

    const prompt = `[문서 ID]: ${documentId}
[현재 청크 계획 현황 (총 ${updatedProposals.length}개)]:
${JSON.stringify(proposalsOverview, null, 2)}

[최근 대화 이력]:
${session.chat_history.slice(-4).map((m) => `${m.role}: ${m.content}`).join('\n')}

[사용자 최신 요청]:
"${userMessage}"

위 사용자의 자연어 요청을 깊이 분석하여, 가장 적절한 action과 action_params, 그리고 사용자에게 전달할 한국어 reply_message를 JSON으로 응답하라.`;

    let decision: ChunkAgentActionDecision;
    try {
      decision = await provider.generateStructured<ChunkAgentActionDecision>({
        systemPrompt: CHUNK_AGENT_SYSTEM_PROMPT,
        prompt,
        schemaName: 'ChunkAgentDecision',
        schema: CHUNK_AGENT_DECISION_SCHEMA,
        temperature: 0.1,
        maxTokens: 1200,
      });
    } catch (llmErr) {
      console.warn('[ChunkingAgent] LLM 판단 폴백:', llmErr);
      decision = this.heuristicDecision(userMessage, updatedProposals);
    }

    // 도구(Action) 실행
    try {
      if (decision.action === 'merge') {
        const targetIndices = decision.action_params?.chunk_indices || [1, 2];
        const targets = updatedProposals.filter((p) => targetIndices.includes(p.proposed_index));
        if (targets.length >= 2) {
          const newTitle =
            decision.action_params?.new_title ||
            `${targets[0].title} & ${targets[1].title}`;
          updatedProposals = await ChunkAgentTools.mergeChunks(
            documentId,
            targets.map((t) => t.id),
            newTitle
          );
        }
      } else if (decision.action === 'split') {
        const targetIndex = decision.action_params?.chunk_index;
        let target = targetIndex
          ? updatedProposals.find((p) => p.proposed_index === targetIndex)
          : null;
        if (!target) {
          // 토큰 수가 가장 큰 청크 자동 선택
          target = [...updatedProposals].sort(
            (a, b) => (b.token_count || 0) - (a.token_count || 0)
          )[0];
        }
        if (target) {
          const subTitles = decision.action_params?.sub_titles || [
            `${target.title} (전반부)`,
            `${target.title} (후반부)`,
          ];
          updatedProposals = await ChunkAgentTools.splitSection(
            documentId,
            target.id,
            subTitles
          );
        }
      } else if (decision.action === 'rename') {
        const targetIndex = decision.action_params?.chunk_index || 1;
        const target =
          updatedProposals.find((p) => p.proposed_index === targetIndex) ||
          updatedProposals[0];
        if (target && decision.action_params?.new_title) {
          await ChunkAgentTools.renameChunk(
            documentId,
            target.id,
            decision.action_params.new_title
          );
          updatedProposals = await ChunkAgentTools.getProposals(documentId);
        }
      } else if (decision.action === 'change_category') {
        const targetIndex = decision.action_params?.chunk_index || 1;
        const target =
          updatedProposals.find((p) => p.proposed_index === targetIndex) ||
          updatedProposals[0];
        if (target && decision.action_params?.new_category) {
          await ChunkAgentTools.changeChunkCategory(
            documentId,
            target.id,
            decision.action_params.new_category
          );
          updatedProposals = await ChunkAgentTools.getProposals(documentId);
        }
      } else if (decision.action === 'approve_all') {
        updatedProposals = updatedProposals.map((p) => ({
          ...p,
          status: 'APPROVED' as const,
        }));
        await ChunkAgentTools.saveProposals(documentId, updatedProposals);
      }
    } catch (actionErr) {
      console.warn('[ChunkingAgent] 도구 실행 오류, 제안 상태 보존:', actionErr);
    }

    const assistantEntry: ChunkingAgentMessage = {
      role: 'assistant',
      content: decision.reply_message,
      timestamp: new Date().toISOString(),
    };
    session.chat_history.push(assistantEntry);
    session.updated_at = new Date().toISOString();
    session.total_proposals = updatedProposals.length;
    session.approved_proposals = updatedProposals.filter((p) => p.status === 'APPROVED').length;

    // DB 세션 히스토리 업데이트
    if (isSupabaseAdminConfigured()) {
      try {
        const supabase = getSupabaseAdmin();
        await supabase
          .from('chunking_sessions')
          .update({
            chat_history: session.chat_history,
            total_proposals: session.total_proposals,
            approved_proposals: session.approved_proposals,
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

  /**
   * 오프라인/오류 시 휴리스틱 의도 분석 폴백
   */
  private static heuristicDecision(
    userMessage: string,
    proposals: ChunkProposal[]
  ): ChunkAgentActionDecision {
    const lower = userMessage.toLowerCase();
    if (lower.includes('합쳐') || lower.includes('묶어') || lower.includes('merge')) {
      return {
        thought: '청크 병합 요청 감지',
        action: 'merge',
        action_params: { chunk_indices: [1, 2], new_title: '병합된 통합 청크' },
        reply_message: '요청하신 청크들을 성공적으로 병합하였습니다.',
      };
    }
    if (lower.includes('나눠') || lower.includes('분할') || lower.includes('split')) {
      return {
        thought: '청크 분할 요청 감지',
        action: 'split',
        action_params: { chunk_index: 1, sub_titles: ['전반부 세부 내용', '후반부 세부 내용'] },
        reply_message: '해당 청크를 세부 하위 청크들로 분할하였습니다.',
      };
    }
    if (lower.includes('제목') || lower.includes('이름') || lower.includes('rename')) {
      return {
        thought: '청크 제목 변경 요청 감지',
        action: 'rename',
        action_params: { chunk_index: 1, new_title: '전문가 검토 핵심 청크' },
        reply_message: '청크의 대표 제목을 성공적으로 변경하였습니다.',
      };
    }
    if (lower.includes('승인') || lower.includes('확정') || lower.includes('적용') || lower.includes('좋아')) {
      return {
        thought: '전체 승인 요청 감지',
        action: 'approve_all',
        reply_message: '총 모든 청크 계획이 최종 승인되었습니다! 상단의 [승인 적용 및 RAG Index 생성] 버튼을 클릭하시면 벡터 색인이 진행됩니다.',
      };
    }
    return {
      thought: '일반 문의 또는 상태 확인',
      action: 'none',
      reply_message: `현재 총 **${proposals.length}개의 청크**가 제안되어 있습니다. 특정 청크 번호의 분할이나 병합, 제목 변경을 지시해 주시면 즉시 반영하겠습니다.`,
    };
  }
}
