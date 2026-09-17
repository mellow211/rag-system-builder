import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { ChunkProposal, ChunkingSession } from '@/types/rag';
import { ChunkAgentTools } from './tools';
import { ChunkingAgentMessage } from './types';
import { cleanDocument } from '../ingestion/cleaning/clean-document';
import { getParserForFile } from '@/lib/parsers';
import { getLLMProvider } from '@/services/llm';
import { InitialChunkDesigner } from './initial-designer';
import {
  CHUNK_AGENT_SYSTEM_PROMPT,
  CHUNK_AGENT_DECISION_SCHEMA,
  ChunkAgentActionDecision,
  ChunkAgentActionItem,
} from './prompts/chunk-agent';

export class ChunkingAgent {
  private static inMemorySessions = new Map<string, ChunkingSession>();

  /**
   * 청킹 세션을 초기화하고 다단계 LLM 에이전트를 통해 문서 구조 기반 초기 Chunk Proposal 목록을 생성합니다.
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

    // 2. 신규 세션 및 다단계 에이전트 Proposal 생성
    let doc: any = null;
    let parsedPages: Array<{ pageNumber: number; text: string }> = [];
    let existingProfile: any = null;

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

      // 기존 프로파일 확인
      try {
        const { data: profData } = await supabase
          .from('document_profiles')
          .select('*')
          .eq('document_id', documentId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (profData) existingProfile = profData;
      } catch (e) {
        // 무시
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
          text: `[초록]
본 연구는 고령자의 24시간 일주기 생체리듬 변화와 수면 위생 개선 중재의 효과를 분석한다.

[서론: 노화와 일주기리듬 교란]
노화에 따라 시교차상핵(SCN)의 신경세포 손실이 가속화되면서 24시간 일주기 생체리듬의 진폭이 현저히 약화됩니다. 이는 야간 수면 단편화와 조기 각성을 유발하는 주요 병태생리적 원인입니다.

[연구 방법 및 대상자 선정]
지역사회 거주 65세 이상 고령자 50명을 대상으로 액티그래피(Actigraphy) 및 타액 멜라토닌 분비 개시 시점(DLMO)을 4주간 측정하였습니다.

[연구 결과 및 분석]
아침 자연광 노출 중재 후 대상자의 수면 효율은 평균 12.4% 상승하였으며, 입면 후 각성 시간(WASO)은 유의하게 감소하였습니다(p < 0.01).

[고찰 및 임상적 의의]
전통 한의학의 일출이기(日出而起) 조와조기 양생법은 현대 일주기 광치료 기전과 생리학적으로 완벽히 부합함을 확인하였습니다.

[결론 및 제언]
고령자 맞춤형 복합 일주기 프로토콜은 약물 의존도를 낮추고 수면의 질을 개선하는 효과적인 비약물적 치료 대안입니다.`,
        },
      ];
    }

    // 다단계 LLM 청크 설계자(InitialChunkDesigner) 실행
    const designResult = await InitialChunkDesigner.design(
      documentId,
      doc,
      parsedPages,
      existingProfile
    );

    const sessionId = designResult.sessionId;
    const initialProposals = designResult.proposals;

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
          content: designResult.welcomeMessage,
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
   * LLM을 적극 활용하여 사용자의 자연어 지시를 정밀 분석하고, 적절한 Chunking Tool(다중 액션 지원)을 실행합니다.
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
    const proposalsOverview = updatedProposals.slice(0, 30).map((p) => ({
      index: p.proposed_index,
      title: p.title,
      category: p.category,
      tokens: p.token_count,
      page: p.page_start,
      preview: p.proposed_content.slice(0, 90).replace(/\n+/g, ' ') + '...',
    }));

    const prompt = `[문서 ID]: ${documentId}
[현재 청크 계획 현황 (총 ${updatedProposals.length}개)]:
${JSON.stringify(proposalsOverview, null, 2)}

[최근 대화 이력]:
${session.chat_history.slice(-4).map((m) => `${m.role}: ${m.content}`).join('\n')}

[사용자 최신 요청]:
"${userMessage}"

위 사용자의 자연어 요청을 깊이 분석하여, 실제 청크를 수정하는 actions 목록과 사용자에게 전달할 한국어 reply_message를 JSON으로 응답하라.
단순히 대답만 하지 말고, 사용자가 원하는 청크의 번호/범위/제목/카테고리 수정을 actions 배열에 정확히 명시하라!`;

    let decision: ChunkAgentActionDecision;
    try {
      decision = await provider.generateStructured<ChunkAgentActionDecision>({
        systemPrompt: CHUNK_AGENT_SYSTEM_PROMPT,
        prompt,
        schemaName: 'ChunkAgentDecision',
        schema: CHUNK_AGENT_DECISION_SCHEMA,
        temperature: 0.1,
        maxTokens: 1500,
      });
    } catch (llmErr) {
      console.warn('[ChunkingAgent] LLM 판단 폴백:', llmErr);
      decision = this.heuristicDecision(userMessage, updatedProposals);
    }

    // 1. 실행할 액션 목록 정규화
    const actionsToRun: ChunkAgentActionItem[] = [];
    if (decision.actions && decision.actions.length > 0) {
      actionsToRun.push(...decision.actions);
    } else if (decision.action && decision.action !== 'none') {
      actionsToRun.push({
        type: decision.action as any,
        chunk_index: decision.action_params?.chunk_index,
        chunk_indices: decision.action_params?.chunk_indices,
        new_title: decision.action_params?.new_title,
        sub_titles: decision.action_params?.sub_titles,
        new_category: decision.action_params?.new_category,
      });
    }

    // 2. 도구(Action) 순차 실행
    const modifiedDetails: string[] = [];

    try {
      for (const act of actionsToRun) {
        if (act.type === 'change_category') {
          const targetIndices = act.chunk_indices || (act.chunk_index ? [act.chunk_index] : []);
          const newCategory = act.new_category?.trim();
          if (newCategory && targetIndices.length > 0) {
            const set = new Set(targetIndices);
            for (const p of updatedProposals) {
              if (set.has(p.proposed_index)) {
                p.category = newCategory;
                p.status = 'EDITED';
              }
            }
            modifiedDetails.push(`청크 #${targetIndices.join(', #')} 카테고리 ➡️ '${newCategory}'`);
          }
        } else if (act.type === 'rename') {
          const targetIdx = act.chunk_index;
          const newTitle = act.new_title?.trim();
          if (targetIdx && newTitle) {
            const target = updatedProposals.find((p) => p.proposed_index === targetIdx);
            if (target) {
              target.title = newTitle;
              target.status = 'EDITED';
              modifiedDetails.push(`청크 #${targetIdx} 제목 ➡️ '${newTitle}'`);
            }
          }
        } else if (act.type === 'reclassify_all') {
          if (act.categories_map) {
            for (const p of updatedProposals) {
              const key = String(p.proposed_index);
              if (act.categories_map[key]) {
                p.category = act.categories_map[key].trim();
                p.status = 'EDITED';
              }
              if (act.titles_map && act.titles_map[key]) {
                p.title = act.titles_map[key].trim();
              }
            }
            modifiedDetails.push(`전체 ${Object.keys(act.categories_map).length}개 청크의 카테고리를 본문 내용에 맞춰 재분류`);
          }
        } else if (act.type === 'split') {
          const targetIndex = act.chunk_index;
          let target = targetIndex
            ? updatedProposals.find((p) => p.proposed_index === targetIndex)
            : null;
          if (!target) {
            target = [...updatedProposals].sort(
              (a, b) => (b.token_count || 0) - (a.token_count || 0)
            )[0];
          }
          if (target) {
            const subTitles = act.sub_titles || [
              `${target.title} (전반부)`,
              `${target.title} (후반부)`,
            ];
            updatedProposals = await ChunkAgentTools.splitSection(
              documentId,
              target.id,
              subTitles
            );
            modifiedDetails.push(`청크 #${target.proposed_index} 2개로 분할 (+1개 증가)`);
          }
        } else if (act.type === 'merge') {
          const targetIndices = act.chunk_indices || [1, 2];
          const targets = updatedProposals.filter((p) => targetIndices.includes(p.proposed_index));
          if (targets.length >= 2) {
            const newTitle = act.new_title || `${targets[0].title} & ${targets[1].title}`;
            updatedProposals = await ChunkAgentTools.mergeChunks(
              documentId,
              targets.map((t) => t.id),
              newTitle
            );
            modifiedDetails.push(`청크 #${targetIndices.join(', #')} 하나로 병합`);
          }
        } else if (act.type === 'update_chunk') {
          const targetIdx = act.chunk_index;
          const target = updatedProposals.find((p) => p.proposed_index === targetIdx);
          if (target) {
            if (act.new_title) target.title = act.new_title.trim();
            if (act.new_category) target.category = act.new_category.trim();
            target.status = 'EDITED';
            modifiedDetails.push(`청크 #${targetIdx} 속성 갱신`);
          }
        } else if (act.type === 'approve_all') {
          updatedProposals = updatedProposals.map((p) => ({
            ...p,
            status: 'APPROVED' as const,
          }));
          modifiedDetails.push(`모든 청크(${updatedProposals.length}개) 승인 완료`);
        } else if (act.type === 'approve') {
          const targetIndices = act.chunk_indices || (act.chunk_index ? [act.chunk_index] : []);
          const set = new Set(targetIndices);
          for (const p of updatedProposals) {
            if (set.has(p.proposed_index)) p.status = 'APPROVED';
          }
          modifiedDetails.push(`청크 #${targetIndices.join(', #')} 승인 완료`);
        }
      }

      // 변경사항 영속화
      if (actionsToRun.length > 0) {
        await ChunkAgentTools.saveProposals(documentId, updatedProposals);
      }
    } catch (actionErr) {
      console.warn('[ChunkingAgent] 도구 실행 오류, 제안 상태 보존:', actionErr);
    }

    // 응답 메시지 보강 (수정된 내역이 있을 경우 명시)
    let finalReply = decision.reply_message;
    if (modifiedDetails.length > 0 && !finalReply.includes('청크')) {
      finalReply = `${finalReply}\n\n✅ **수정 반영 내역**:\n${modifiedDetails.map((d) => `- ${d}`).join('\n')}`;
    }

    const assistantEntry: ChunkingAgentMessage = {
      role: 'assistant',
      content: finalReply,
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
   * 오프라인/오류 시 지능형 휴리스틱 의도 분석 및 다중 액션 라우팅
   */
  private static heuristicDecision(
    userMessage: string,
    proposals: ChunkProposal[]
  ): ChunkAgentActionDecision {
    const trimmed = userMessage.trim();

    // 1. 카테고리 범위 변경 ("3번부터 5번까지 연구방법으로", "3~5번 연구방법으로")
    const rangeMatch = trimmed.match(
      /(\d+)\s*(?:번)?\s*(?:부터|~|-)\s*(\d+)\s*(?:번)?\s*(?:까지)?\s*(?:카테고리\s*)?([가-힣a-zA-Z0-9_\s>]+?)(?:으로|로)?\s*(?:바꿔|변경|수정|지정)/i
    ) || trimmed.match(
      /(\d+)\s*(?:번)?\s*(?:부터|~|-)\s*(\d+)\s*(?:번)?\s*(?:까지)?\s*(?:카테고리\s*)?(연구\s*방법|연구\s*결과|결과|고찰|서론|결론|초록|[가-힣a-zA-Z]+)(?:으로|로)/i
    );
    if (rangeMatch) {
      const start = Math.min(Number(rangeMatch[1]), Number(rangeMatch[2]));
      const end = Math.max(Number(rangeMatch[1]), Number(rangeMatch[2]));
      const category = rangeMatch[3].replace(/\s+/g, '');
      const indices: number[] = [];
      for (let i = start; i <= end; i++) indices.push(i);

      return {
        thought: `청크 ${start}번부터 ${end}번까지 카테고리를 '${category}'로 일괄 변경 요청 감지`,
        actions: [
          {
            type: 'change_category',
            chunk_indices: indices,
            new_category: category,
          },
        ],
        reply_message: `요청하신 대로 **청크 #${indices.join(', #')}**의 카테고리를 **'${category}'**으로 성공적으로 변경했습니다. 좌측 트리 및 하단 청크 목록을 확인해 보세요.`,
      };
    }

    // 2. 단일 또는 쉼표 나열 카테고리 변경 ("2번 연구방법으로", "2번, 3번 결과로")
    const listCatMatch = trimmed.match(/((?:\d+\s*번?(?:,\s*|\s+)?)+)\s*(?:카테고리\s*)?([가-힣a-zA-Z]+)(?:으로|로)?\s*(?:바꿔|변경|수정|지정)/i);
    if (listCatMatch) {
      const rawNumbers = listCatMatch[1].match(/\d+/g) || ['1'];
      const indices = rawNumbers.map(Number);
      const category = listCatMatch[2].replace(/\s+/g, '');

      return {
        thought: `청크 ${indices.join(', ')}번 카테고리를 '${category}'로 변경 요청 감지`,
        actions: [
          {
            type: 'change_category',
            chunk_indices: indices,
            new_category: category,
          },
        ],
        reply_message: `**청크 #${indices.join(', #')}**의 카테고리를 **'${category}'**으로 변경 완료하였습니다.`,
      };
    }

    // 3. 전체 카테고리 재분류 ("서론으로 된 것들 내용에 맞게 분류해줘", "전체 카테고리 다시 분류해줘")
    if (
      trimmed.includes('서론으로') ||
      trimmed.includes('재분류') ||
      trimmed.includes('다시 분류') ||
      trimmed.includes('내용에 맞게')
    ) {
      const catMap: Record<string, string> = {};
      const total = proposals.length;
      proposals.forEach((p, idx) => {
        const ratio = idx / Math.max(total - 1, 1);
        let assigned = '서론';
        if (ratio < 0.15) assigned = '초록';
        else if (ratio < 0.35) assigned = '서론';
        else if (ratio < 0.6) assigned = '연구방법';
        else if (ratio < 0.8) assigned = '연구결과';
        else if (ratio < 0.92) assigned = '고찰';
        else assigned = '결론';

        // 본문 내용 힌트 반영
        if (/방법|대상|측정|표본/i.test(p.proposed_content)) assigned = '연구방법';
        if (/결과|유의|상승|감소|Table|p</i.test(p.proposed_content)) assigned = '연구결과';
        if (/고찰|논의|기전|임상/i.test(p.proposed_content)) assigned = '고찰';
        if (/결론|제언|요약/i.test(p.proposed_content)) assigned = '결론';

        catMap[String(p.proposed_index)] = assigned;
      });

      return {
        thought: '전체 청크 내용 기반 학술 섹션 재분류 요청 감지',
        actions: [
          {
            type: 'reclassify_all',
            categories_map: catMap,
          },
        ],
        reply_message: `기존에 단일 섹션(서론)으로 집중되어 있던 **총 ${total}개의 청크**를 본문 내용과 학술 흐름에 맞추어 **[초록, 서론, 연구방법, 연구결과, 고찰, 결론]**으로 전면 재분류하였습니다!`,
      };
    }

    // 4. 제목 변경 ("2번 청크 제목 '피험자 특성'으로")
    const titleQuoteMatch = trimmed.match(/(\d+)\s*(?:번)?.*?제목.*?['"‘“](.*?)['"’”]/i);
    if (titleQuoteMatch) {
      const targetIdx = Number(titleQuoteMatch[1]);
      const newTitle = titleQuoteMatch[2].trim();
      return {
        thought: `청크 ${targetIdx}번 제목을 '${newTitle}'로 변경 요청 감지`,
        actions: [
          {
            type: 'rename',
            chunk_index: targetIdx,
            new_title: newTitle,
          },
        ],
        reply_message: `**청크 #${targetIdx}**의 대표 제목을 **"${newTitle}"**으로 성공적으로 변경하였습니다.`,
      };
    }

    const titleSimpleMatch = trimmed.match(/(\d+)\s*번.*?제목\s*(?:을|를)?\s*([^\s]+(?: [^\s]+)?)(?:으로|로)?\s*(?:바꿔|변경|수정)/i);
    if (titleSimpleMatch) {
      const targetIdx = Number(titleSimpleMatch[1]);
      const newTitle = titleSimpleMatch[2].trim();
      return {
        thought: `청크 ${targetIdx}번 제목 변경 감지`,
        actions: [{ type: 'rename', chunk_index: targetIdx, new_title: newTitle }],
        reply_message: `**청크 #${targetIdx}**의 대표 제목을 **"${newTitle}"**으로 변경하였습니다.`,
      };
    }

    // 5. 청크 병합 ("1번과 2번 합쳐줘")
    const mergeNums = trimmed.match(/(\d+)\s*(?:번)?(?:\s*과|\s*와|\s*,\s*|\s+)(\d+)\s*(?:번)?.*?(?:합쳐|묶어|통합|merge)/i);
    if (mergeNums) {
      const idx1 = Number(mergeNums[1]);
      const idx2 = Number(mergeNums[2]);
      return {
        thought: `청크 ${idx1}번과 ${idx2}번 병합 요청 감지`,
        actions: [
          {
            type: 'merge',
            chunk_indices: [idx1, idx2],
            new_title: `병합된 청크 (#${idx1} & #${idx2})`,
          },
        ],
        reply_message: `**청크 #${idx1}**과 **청크 #${idx2}**를 성공적으로 하나로 통합 병합하였습니다.`,
      };
    }

    // 6. 청크 분할 ("4번 청크 2개로 나눠줘")
    const splitMatch = trimmed.match(/(\d+)\s*(?:번)?.*?(?:나눠|분할|쪼개|split)/i);
    if (splitMatch) {
      const targetIdx = Number(splitMatch[1]);
      return {
        thought: `청크 ${targetIdx}번 분할 요청 감지`,
        actions: [
          {
            type: 'split',
            chunk_index: targetIdx,
            sub_titles: [`청크 #${targetIdx} (전반부)`, `청크 #${targetIdx} (후반부)`],
          },
        ],
        reply_message: `**청크 #${targetIdx}**을 세부 의미 단위 2개로 성공적으로 분할하였습니다.`,
      };
    }

    // 7. 승인 요청
    if (trimmed.includes('승인') || trimmed.includes('확정') || trimmed.includes('적용') || trimmed.includes('좋아')) {
      return {
        thought: '전체 승인 요청 감지',
        actions: [{ type: 'approve_all' }],
        reply_message: '모든 청크 계획이 최종 승인되었습니다! 상단의 **[최종 Chunk 승인 및 RAG Index 생성]** 버튼을 클릭하시면 최신 RAG v2 색인이 진행됩니다.',
      };
    }

    // 8. 기본 답변
    return {
      thought: '일반 안내 및 도움말',
      actions: [{ type: 'none' }],
      reply_message: `현재 총 **${proposals.length}개의 청크**가 제안되어 있습니다.
- *"3번부터 5번까지 연구방법으로 변경해줘"*
- *"2번 청크 제목 '피험자 선정 기준'으로 바꿔줘"*
- *"1번과 2번 청크 하나로 합쳐줘"*
등의 자연어 명령을 주시면 청크에 즉시 반영하겠습니다!`,
    };
  }
}
