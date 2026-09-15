import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { ChunkProposal } from '@/types/rag';
import { DocumentSectionNode, ChunkPlanSummary } from './types';
import { TokenCounter } from '@/lib/chunking/token-counter';

export class ChunkAgentTools {
  private static inMemoryProposals = new Map<string, ChunkProposal[]>();

  public static getInMemory(documentId: string): ChunkProposal[] {
    return this.inMemoryProposals.get(documentId) || [];
  }

  public static setInMemory(documentId: string, proposals: ChunkProposal[]): void {
    this.inMemoryProposals.set(documentId, proposals);
  }

  /**
   * Tool 1: analyzeDocumentStructure - 문서의 전체 섹션 트리 및 토큰 분포 분석
   */
  public static async analyzeDocumentStructure(documentId: string): Promise<DocumentSectionNode[]> {
    const proposals = await this.getProposals(documentId);
    const rootMap = new Map<string, DocumentSectionNode>();

    for (const p of proposals) {
      const topSection = p.section_path?.[0] || p.title || '기본 섹션';
      if (!rootMap.has(topSection)) {
        rootMap.set(topSection, {
          title: topSection,
          level: 1,
          sectionPath: [topSection],
          pageStart: p.page_start || 1,
          pageEnd: p.page_end || 1,
          tokenCount: 0,
          childCount: 0,
          children: [],
          proposals: [],
        });
      }

      const node = rootMap.get(topSection)!;
      node.tokenCount += p.token_count || 0;
      node.childCount += 1;
      node.pageEnd = Math.max(node.pageEnd, p.page_end || 1);
      node.proposals!.push(p);
    }

    return Array.from(rootMap.values());
  }

  /**
   * Tool 2: getSections - 주요 섹션 목록 조회
   */
  public static async getSections(documentId: string): Promise<string[]> {
    const tree = await this.analyzeDocumentStructure(documentId);
    return tree.map((n) => n.title);
  }

  /**
   * Tool 3: previewChunkPlan - 청크 플랜 통계 요약 조회
   */
  public static async previewChunkPlan(documentId: string): Promise<ChunkPlanSummary> {
    const proposals = await this.getProposals(documentId);
    const totalTokens = proposals.reduce((sum, p) => sum + (p.token_count || 0), 0);
    const avgTokens = proposals.length > 0 ? Math.round(totalTokens / proposals.length) : 0;

    const statusCounts = {
      proposed: proposals.filter((p) => p.status === 'PROPOSED').length,
      edited: proposals.filter((p) => p.status === 'EDITED').length,
      approved: proposals.filter((p) => p.status === 'APPROVED').length,
      rejected: proposals.filter((p) => p.status === 'REJECTED').length,
    };

    const sections = new Set(proposals.map((p) => p.section_path?.[0] || '기본')).size;

    return {
      documentId,
      totalProposals: proposals.length,
      totalTokens,
      avgTokens,
      statusCounts,
      sectionsCount: sections,
    };
  }

  /**
   * Tool 4: splitSection - 긴 청크 또는 섹션을 2개 이상의 세부 청크로 분할
   */
  public static async splitSection(
    documentId: string,
    proposalId: string,
    subTitles: string[]
  ): Promise<ChunkProposal[]> {
    const proposals = await this.getProposals(documentId);
    const targetIdx = proposals.findIndex((p) => p.id === proposalId);
    if (targetIdx === -1) {
      throw new Error(`분할할 청크(ID: ${proposalId})를 찾을 수 없습니다.`);
    }

    const target = proposals[targetIdx];
    const content = target.proposed_content;
    const splitCount = Math.max(subTitles.length, 2);

    // 본문 균등 분할
    const sentences = content.split(/(?<=[.!?])\s+/);
    const chunkSize = Math.ceil(sentences.length / splitCount);

    const newProposals: ChunkProposal[] = [];
    for (let i = 0; i < splitCount; i++) {
      const partSentences = sentences.slice(i * chunkSize, (i + 1) * chunkSize);
      const partContent = partSentences.join(' ').trim() || content;
      const partTitle = subTitles[i] || `${target.title} (Part ${i + 1})`;

      newProposals.push({
        id: `${target.id}-split-${i + 1}`,
        session_id: target.session_id,
        document_id: target.document_id,
        proposed_index: target.proposed_index + i,
        section_path: [...target.section_path, partTitle],
        title: partTitle,
        proposed_content: partContent,
        token_count: TokenCounter.count(partContent),
        chunk_type: target.chunk_type,
        category: target.category,
        page_start: target.page_start,
        page_end: target.page_end,
        parent_id: target.id,
        status: 'EDITED',
        created_at: new Date().toISOString(),
      });
    }

    // 기존 청크를 새 청크들로 교체
    proposals.splice(targetIdx, 1, ...newProposals);
    // index 재정렬
    proposals.forEach((p, idx) => {
      p.proposed_index = idx + 1;
    });

    await this.saveProposals(documentId, proposals);
    return proposals;
  }

  /**
   * Tool 5: mergeChunks - 복수의 청크를 하나로 병합
   */
  public static async mergeChunks(
    documentId: string,
    proposalIds: string[],
    newTitle: string
  ): Promise<ChunkProposal[]> {
    const proposals = await this.getProposals(documentId);
    const targets = proposals.filter((p) => proposalIds.includes(p.id));
    if (targets.length < 2) {
      throw new Error('병합을 위해서는 최소 2개 이상의 청크를 선택해야 합니다.');
    }

    const firstTarget = targets[0];
    const firstIdx = proposals.findIndex((p) => p.id === firstTarget.id);

    const mergedContent = targets.map((t) => t.proposed_content).join('\n\n');
    const minPage = Math.min(...targets.map((t) => t.page_start || 1));
    const maxPage = Math.max(...targets.map((t) => t.page_end || 1));

    const mergedProposal: ChunkProposal = {
      id: `${firstTarget.id}-merged`,
      session_id: firstTarget.session_id,
      document_id: documentId,
      proposed_index: firstTarget.proposed_index,
      section_path: firstTarget.section_path,
      title: newTitle || `${firstTarget.title} (통합본)`,
      proposed_content: mergedContent,
      token_count: TokenCounter.count(mergedContent),
      chunk_type: firstTarget.chunk_type,
      category: firstTarget.category,
      page_start: minPage,
      page_end: maxPage,
      status: 'EDITED',
      created_at: new Date().toISOString(),
    };

    // 타겟 청크 제거 후 첫 위치에 병합 청크 삽입
    const filtered = proposals.filter((p) => !proposalIds.includes(p.id));
    filtered.splice(firstIdx, 0, mergedProposal);
    filtered.forEach((p, idx) => {
      p.proposed_index = idx + 1;
    });

    await this.saveProposals(documentId, filtered);
    return filtered;
  }

  /**
   * Tool 6: renameChunk - 청크 제목 수정
   */
  public static async renameChunk(
    documentId: string,
    proposalId: string,
    newTitle: string
  ): Promise<ChunkProposal> {
    const proposals = await this.getProposals(documentId);
    const target = proposals.find((p) => p.id === proposalId);
    if (!target) throw new Error(`청크 ${proposalId}를 찾을 수 없습니다.`);

    target.title = newTitle.trim();
    target.status = 'EDITED';
    await this.saveProposals(documentId, proposals);
    return target;
  }

  /**
   * Tool 7: changeChunkCategory - 청크 카테고리 변경
   */
  public static async changeChunkCategory(
    documentId: string,
    proposalId: string,
    newCategory: string
  ): Promise<ChunkProposal> {
    const proposals = await this.getProposals(documentId);
    const target = proposals.find((p) => p.id === proposalId);
    if (!target) throw new Error(`청크 ${proposalId}를 찾을 수 없습니다.`);

    target.category = newCategory.trim();
    target.status = 'EDITED';
    await this.saveProposals(documentId, proposals);
    return target;
  }

  /**
   * Tool 8: setChunkType - 청크 타입 지정 (table, list, qa, paragraph 등)
   */
  public static async setChunkType(
    documentId: string,
    proposalId: string,
    newType: string
  ): Promise<ChunkProposal> {
    const proposals = await this.getProposals(documentId);
    const target = proposals.find((p) => p.id === proposalId);
    if (!target) throw new Error(`청크 ${proposalId}를 찾을 수 없습니다.`);

    target.chunk_type = newType;
    target.status = 'EDITED';
    await this.saveProposals(documentId, proposals);
    return target;
  }

  /**
   * Tool 9: previewChunks - 전체 청크 목록 조회
   */
  public static async previewChunks(documentId: string): Promise<ChunkProposal[]> {
    return this.getProposals(documentId);
  }

  // 내부 영속화 헬퍼 (DB + InMemory)
  public static async getProposals(documentId: string): Promise<ChunkProposal[]> {
    if (this.inMemoryProposals.has(documentId)) {
      return this.inMemoryProposals.get(documentId)!;
    }

    if (isSupabaseAdminConfigured()) {
      try {
        const supabase = getSupabaseAdmin();
        const { data } = await supabase
          .from('chunk_proposals')
          .select('*')
          .eq('document_id', documentId)
          .order('proposed_index', { ascending: true });

        if (data && data.length > 0) {
          const list = data as ChunkProposal[];
          this.inMemoryProposals.set(documentId, list);
          return list;
        }
      } catch (err) {
        console.warn('[ChunkAgentTools] DB proposals 조회 경고:', err);
      }
    }

    return [];
  }

  public static async saveProposals(documentId: string, proposals: ChunkProposal[]): Promise<void> {
    this.inMemoryProposals.set(documentId, proposals);

    if (isSupabaseAdminConfigured()) {
      try {
        const supabase = getSupabaseAdmin();
        // 일괄 삭제 후 재저장 (순서 보장)
        await supabase.from('chunk_proposals').delete().eq('document_id', documentId);

        const rows = proposals.map((p) => ({
          session_id: p.session_id,
          document_id: documentId,
          proposed_index: p.proposed_index,
          section_path: p.section_path,
          title: p.title,
          proposed_content: p.proposed_content,
          token_count: p.token_count,
          chunk_type: p.chunk_type,
          category: p.category,
          page_start: p.page_start,
          page_end: p.page_end,
          parent_id: p.parent_id || null,
          status: p.status,
        }));

        const batchSize = 50;
        for (let i = 0; i < rows.length; i += batchSize) {
          await supabase.from('chunk_proposals').insert(rows.slice(i, i + batchSize));
        }
      } catch (err) {
        console.warn('[ChunkAgentTools] DB proposals 저장 경고:', err);
      }
    }
  }
}
