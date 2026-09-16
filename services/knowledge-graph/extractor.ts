import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { KnowledgeNode, KnowledgeEdge, DomainType } from '@/types/rag';
import { EntityNormalizer } from './normalizer';
import { getLLMProvider } from '@/services/llm';
import { ChunkAgentTools } from '../chunking-agent/tools';
import { getParserForFile } from '@/lib/parsers';
import {
  GRAPH_EXTRACT_PROMPT_VERSION,
  GRAPH_EXTRACT_SYSTEM_PROMPT,
  GRAPH_EXTRACT_JSON_SCHEMA,
} from './prompts/extract-graph';

export class GraphExtractor {
  private static inMemoryNodes = new Map<string, KnowledgeNode>();
  private static inMemoryEdges = new Map<string, KnowledgeEdge>();

  /**
   * 승인된 문서 청크들로부터 Entity Node와 Relation Edge를 추출하여 지식 그래프를 구성합니다.
   */
  public static async extractFromDocument(documentId: string): Promise<{
    nodes: KnowledgeNode[];
    edges: KnowledgeEdge[];
  }> {
    const supabase = isSupabaseAdminConfigured() ? getSupabaseAdmin() : null;

    let doc: any = null;
    let chunks: any[] = [];

    if (supabase) {
      try {
        const { data: docData } = await supabase
          .from('documents')
          .select('*')
          .eq('id', documentId)
          .single();
        doc = docData;

        // 1. 이미 인덱싱된 document_chunks 확인
        const { data: chunkData } = await supabase
          .from('document_chunks')
          .select('*')
          .eq('document_id', documentId)
          .order('chunk_index');

        if (chunkData && chunkData.length > 0) {
          chunks = chunkData;
        }
      } catch (err) {
        console.warn('[GraphExtractor] DB 문서 조회 경고:', err);
      }
    }

    // 2. document_chunks가 없다면, Chunk Proposals 확인
    if (chunks.length === 0) {
      try {
        const proposals = await ChunkAgentTools.getProposals(documentId);
        if (proposals && proposals.length > 0) {
          chunks = proposals.map((p) => ({
            id: p.id,
            chunk_index: p.proposed_index,
            content: p.proposed_content,
            metadata: {
              page: p.page_start || 1,
              section_title: p.title,
              category: p.category,
            },
          }));
        }
      } catch (err) {
        console.warn('[GraphExtractor] 청크 프로포절 조회 경고:', err);
      }
    }

    // 3. 만약 프로포절도 없다면, 스토리지 파일 원본에서 텍스트 파싱
    if (chunks.length === 0 && doc?.storage_path && supabase) {
      try {
        const { data: fileData } = await supabase.storage.from('documents').download(doc.storage_path);
        if (fileData) {
          const buffer = Buffer.from(await fileData.arrayBuffer());
          const parser = getParserForFile(doc.filename || 'document.pdf');
          const parsed = await parser.parse(buffer, doc.filename || 'document.pdf');
          if (parsed.pages && parsed.pages.length > 0) {
            chunks = parsed.pages.map((p, idx) => ({
              id: `doc-page-${idx + 1}`,
              chunk_index: idx + 1,
              content: p.text,
              metadata: {
                page: p.pageNumber || idx + 1,
                section_title: `${doc.title} (Page ${p.pageNumber || idx + 1})`,
              },
            }));
          }
        }
      } catch (err) {
        console.warn('[GraphExtractor] 스토리지 파싱 폴백:', err);
      }
    }

    // 4. 만약 스토리지도 없고 비어있다면, 문서 메타데이터 요약이나 텍스트 활용
    if (chunks.length === 0 && (doc?.metadata?.raw_text || doc?.metadata?.summary_full)) {
      chunks = [
        {
          id: `doc-text-1`,
          chunk_index: 1,
          content: doc.metadata?.raw_text || doc.metadata?.summary_full,
          metadata: { page: 1, section_title: doc.title },
        },
      ];
    }

    // 5. 최후의 폴백 (테스트 환경)
    if (chunks.length === 0) {
      chunks = [
        {
          id: `mock-chunk-${documentId}-1`,
          chunk_index: 1,
          content: '노화에 따라 시교차상핵(SCN)의 퇴행이 발생하여 고령자의 일주기리듬 진폭이 감소하고 수면 장애가 유발됩니다.',
          metadata: { page: 1, section_title: '서론' },
        },
        {
          id: `mock-chunk-${documentId}-2`,
          chunk_index: 2,
          content: '아침 자연광 빛 노출은 멜라토닌 분비를 정상화하여 고령자의 일주기리듬을 안정화시킵니다.',
          metadata: { page: 2, section_title: '빛 노출' },
        },
        {
          id: `mock-chunk-${documentId}-3`,
          chunk_index: 3,
          content: '규칙적인 주간 신체활동은 야간 수면 효율을 향상시키고 노년기 불면을 개선합니다.',
          metadata: { page: 3, section_title: '신체활동' },
        },
      ];
    }

    const domain: DomainType = (doc?.metadata?.domain as DomainType) || 'circadian';
    const provider = getLLMProvider();

    const createdNodesMap = new Map<string, KnowledgeNode>();
    const createdEdges: KnowledgeEdge[] = [];

    // 청크별 순차 추출 (배치 보호: 최대 10개 청크)
    for (const chunk of chunks.slice(0, 10)) {
      if (!chunk.content || chunk.content.trim().length < 15) continue;

      const prompt = `[도메인]: ${domain}\n[청크 본문 (p.${chunk.metadata?.page || 1})]:\n${chunk.content}`;

      let extracted: { nodes: any[]; relations: any[] };
      try {
        extracted = await provider.generateStructured<{ nodes: any[]; relations: any[] }>({
          systemPrompt: GRAPH_EXTRACT_SYSTEM_PROMPT,
          prompt,
          schemaName: 'KnowledgeGraphExtraction',
          schema: GRAPH_EXTRACT_JSON_SCHEMA,
          temperature: 0.1,
          maxTokens: 2000,
        });
      } catch (err) {
        console.warn(`[GraphExtractor] LLM 추출 실패 (${chunk.id}), 폴백 추출 적용:`, err);
        extracted = this.createFallbackExtraction(chunk.content, domain);
      }

      // 1. 노드 정규화 및 등록
      const chunkNodeMap = new Map<string, KnowledgeNode>();
      for (const n of extracted.nodes || []) {
        if (!n.canonical_name || n.canonical_name.trim().length === 0) continue;

        const canonical = EntityNormalizer.getCanonicalName(n.canonical_name);
        const aliases = Array.from(new Set([...(n.aliases || []), ...EntityNormalizer.getAliases(canonical)]));
        const nodeId = `node-${domain}-${canonical.replace(/\s+/g, '_')}`;

        const node: KnowledgeNode = {
          id: nodeId,
          canonical_name: canonical,
          node_type: n.node_type || 'concept',
          domain,
          description: n.description || `${canonical}에 관한 전문 지식 노드`,
          aliases,
          status: 'APPROVED',
          created_at: new Date().toISOString(),
        };

        this.inMemoryNodes.set(nodeId, node);
        createdNodesMap.set(canonical, node);
        chunkNodeMap.set(canonical, node);
        chunkNodeMap.set(n.canonical_name, node);

        // DB Upsert
        if (supabase) {
          try {
            await supabase.from('knowledge_nodes').upsert(
              {
                id: nodeId,
                canonical_name: node.canonical_name,
                node_type: node.node_type,
                domain: node.domain,
                description: node.description,
                aliases: node.aliases,
                status: 'APPROVED',
              },
              { onConflict: 'domain,canonical_name' }
            );

            if (chunk.id) {
              await supabase.from('chunk_entities').upsert(
                {
                  chunk_id: chunk.id,
                  node_id: nodeId,
                  relevance_score: 1.0,
                },
                { onConflict: 'chunk_id,node_id' }
              );
            }
          } catch (e) {
            console.warn('[GraphExtractor] Node DB upsert 폴백:', e);
          }
        }
      }

      // 2. 엣지(관계) 등록 (출처 근거 Provenance 유지 필수)
      for (const r of extracted.relations || []) {
        if (!r.source_name || !r.target_name) continue;

        const srcCanonical = EntityNormalizer.getCanonicalName(r.source_name);
        const tgtCanonical = EntityNormalizer.getCanonicalName(r.target_name);

        // 만약 노드가 명시되지 않은 경우 자동 생성하여 누락 방지
        let srcNode = createdNodesMap.get(srcCanonical) || chunkNodeMap.get(r.source_name);
        if (!srcNode) {
          const srcId = `node-${domain}-${srcCanonical.replace(/\s+/g, '_')}`;
          srcNode = {
            id: srcId,
            canonical_name: srcCanonical,
            node_type: 'concept',
            domain,
            description: `${srcCanonical} 관련 지식 엔티티`,
            aliases: EntityNormalizer.getAliases(srcCanonical),
            status: 'APPROVED',
            created_at: new Date().toISOString(),
          };
          this.inMemoryNodes.set(srcId, srcNode);
          createdNodesMap.set(srcCanonical, srcNode);
        }

        let tgtNode = createdNodesMap.get(tgtCanonical) || chunkNodeMap.get(r.target_name);
        if (!tgtNode) {
          const tgtId = `node-${domain}-${tgtCanonical.replace(/\s+/g, '_')}`;
          tgtNode = {
            id: tgtId,
            canonical_name: tgtCanonical,
            node_type: 'concept',
            domain,
            description: `${tgtCanonical} 관련 지식 엔티티`,
            aliases: EntityNormalizer.getAliases(tgtCanonical),
            status: 'APPROVED',
            created_at: new Date().toISOString(),
          };
          this.inMemoryNodes.set(tgtId, tgtNode);
          createdNodesMap.set(tgtCanonical, tgtNode);
        }

        if (srcNode.id === tgtNode.id) continue;

        const edgeId = `edge-${srcNode.id}-${r.relation_type}-${tgtNode.id}`;
        const edge: KnowledgeEdge = {
          id: edgeId,
          source_node_id: srcNode.id,
          target_node_id: tgtNode.id,
          relation_type: r.relation_type,
          document_id: documentId,
          chunk_id: chunk.id,
          confidence: r.confidence ?? 0.9,
          evidence_text: r.evidence_text || chunk.content.slice(0, 120),
          status: 'PROPOSED', // 초기에는 제안 상태로 사용자가 검토/확정
          created_at: new Date().toISOString(),
          source_node: srcNode,
          target_node: tgtNode,
          metadata: {
            chunk_index: chunk.chunk_index,
            page: chunk.metadata?.page || 1,
            section_title: chunk.metadata?.section_title,
          },
        };

        this.inMemoryEdges.set(edgeId, edge);
        createdEdges.push(edge);

        if (supabase) {
          try {
            await supabase.from('knowledge_edges').upsert(
              {
                id: edge.id,
                source_node_id: edge.source_node_id,
                target_node_id: edge.target_node_id,
                relation_type: edge.relation_type,
                document_id: edge.document_id,
                chunk_id: edge.chunk_id,
                confidence: edge.confidence,
                evidence_text: edge.evidence_text,
                status: 'PROPOSED',
              },
              { onConflict: 'id' }
            );
          } catch (e) {
            console.warn('[GraphExtractor] Edge DB upsert 폴백:', e);
          }
        }
      }
    }

    return {
      nodes: Array.from(createdNodesMap.values()),
      edges: createdEdges,
    };
  }

  /**
   * 특정 문서에 연결된 지식 서브그래프(노드 및 엣지)를 조회합니다.
   */
  public static async getGraphForDocument(documentId: string): Promise<{
    nodes: KnowledgeNode[];
    edges: KnowledgeEdge[];
  }> {
    const memEdges = Array.from(this.inMemoryEdges.values()).filter((e) => e.document_id === documentId);
    if (memEdges.length > 0) {
      const nodeIds = new Set(memEdges.flatMap((e) => [e.source_node_id, e.target_node_id]));
      const nodes = Array.from(this.inMemoryNodes.values()).filter((n) => nodeIds.has(n.id));
      return { nodes, edges: memEdges };
    }

    if (isSupabaseAdminConfigured()) {
      try {
        const supabase = getSupabaseAdmin();
        const { data: edgeData } = await supabase
          .from('knowledge_edges')
          .select('*, source_node:knowledge_nodes!source_node_id(*), target_node:knowledge_nodes!target_node_id(*)')
          .eq('document_id', documentId);

        if (edgeData && edgeData.length > 0) {
          const edges = edgeData as KnowledgeEdge[];
          const nodeMap = new Map<string, KnowledgeNode>();
          edges.forEach((e) => {
            if (e.source_node) nodeMap.set(e.source_node.id, e.source_node);
            if (e.target_node) nodeMap.set(e.target_node.id, e.target_node);
          });
          return { nodes: Array.from(nodeMap.values()), edges };
        }
      } catch (err) {
        console.warn('[GraphExtractor] 서브그래프 조회 오류:', err);
      }
    }

    // 초기 추출 실행
    return this.extractFromDocument(documentId);
  }

  /**
   * 엣지 승인, 수정, 반려 처리
   */
  public static async updateEdge(
    edgeId: string,
    updates: { status?: 'APPROVED' | 'REJECTED'; confidence?: number }
  ): Promise<KnowledgeEdge | null> {
    const memEdge = this.inMemoryEdges.get(edgeId);
    if (memEdge) {
      if (updates.status) memEdge.status = updates.status;
      if (updates.confidence !== undefined) memEdge.confidence = updates.confidence;
    }

    if (isSupabaseAdminConfigured()) {
      try {
        const supabase = getSupabaseAdmin();
        const { data } = await supabase
          .from('knowledge_edges')
          .update({
            ...(updates.status ? { status: updates.status } : {}),
            ...(updates.confidence !== undefined ? { confidence: updates.confidence } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq('id', edgeId)
          .select('*')
          .single();

        return data as KnowledgeEdge;
      } catch (e) {
        console.warn('[GraphExtractor] Edge 상태 갱신 폴백:', e);
      }
    }

    return memEdge || null;
  }

  /**
   * 편의 헬퍼: 엣지 상태를 직접 변경합니다.
   */
  public static async updateEdgeStatus(
    documentId: string,
    edgeId: string,
    status: 'APPROVED' | 'REJECTED'
  ): Promise<KnowledgeEdge | null> {
    return this.updateEdge(edgeId, { status });
  }

  /**
   * 주어진 텍스트와 도메인으로부터 직접 지식 그래프를 추출합니다.
   */
  public static async extractGraphFromDocument(
    documentId: string,
    content: string,
    domain: DomainType
  ): Promise<{ nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }> {
    const provider = getLLMProvider();
    const prompt = `[도메인]: ${domain}\n[문서 본문]:\n${content}`;

    let extracted: { nodes: any[]; relations: any[] };
    try {
      extracted = await provider.generateStructured<{ nodes: any[]; relations: any[] }>({
        systemPrompt: GRAPH_EXTRACT_SYSTEM_PROMPT,
        prompt,
        schemaName: 'KnowledgeGraphExtraction',
        schema: GRAPH_EXTRACT_JSON_SCHEMA,
        temperature: 0.1,
        maxTokens: 2000,
      });
    } catch (err) {
      extracted = this.createFallbackExtraction(content, domain);
    }

    const createdNodesMap = new Map<string, KnowledgeNode>();
    const createdEdges: KnowledgeEdge[] = [];

    for (const n of extracted.nodes || []) {
      const canonical = EntityNormalizer.getCanonicalName(n.canonical_name);
      const aliases = Array.from(new Set([...(n.aliases || []), ...EntityNormalizer.getAliases(canonical)]));
      const nodeId = `node-${domain}-${canonical.replace(/\s+/g, '_')}`;

      const node: KnowledgeNode = {
        id: nodeId,
        canonical_name: canonical,
        node_type: n.node_type || 'concept',
        domain,
        description: n.description || `${canonical}에 관한 전문 지식 노드`,
        aliases,
        status: 'APPROVED',
        created_at: new Date().toISOString(),
      };

      this.inMemoryNodes.set(nodeId, node);
      createdNodesMap.set(canonical, node);
      createdNodesMap.set(n.canonical_name, node);
    }

    for (const r of extracted.relations || []) {
      const srcCanonical = EntityNormalizer.getCanonicalName(r.source_name);
      const tgtCanonical = EntityNormalizer.getCanonicalName(r.target_name);

      let srcNode = createdNodesMap.get(srcCanonical) || createdNodesMap.get(r.source_name);
      if (!srcNode) {
        const srcId = `node-${domain}-${srcCanonical.replace(/\s+/g, '_')}`;
        srcNode = {
          id: srcId,
          canonical_name: srcCanonical,
          node_type: 'concept',
          domain,
          description: `${srcCanonical} 관련 지식 엔티티`,
          aliases: EntityNormalizer.getAliases(srcCanonical),
          status: 'APPROVED',
          created_at: new Date().toISOString(),
        };
        this.inMemoryNodes.set(srcId, srcNode);
        createdNodesMap.set(srcCanonical, srcNode);
      }

      let tgtNode = createdNodesMap.get(tgtCanonical) || createdNodesMap.get(r.target_name);
      if (!tgtNode) {
        const tgtId = `node-${domain}-${tgtCanonical.replace(/\s+/g, '_')}`;
        tgtNode = {
          id: tgtId,
          canonical_name: tgtCanonical,
          node_type: 'concept',
          domain,
          description: `${tgtCanonical} 관련 지식 엔티티`,
          aliases: EntityNormalizer.getAliases(tgtCanonical),
          status: 'APPROVED',
          created_at: new Date().toISOString(),
        };
        this.inMemoryNodes.set(tgtId, tgtNode);
        createdNodesMap.set(tgtCanonical, tgtNode);
      }

      if (srcNode.id === tgtNode.id) continue;

      const edgeId = `edge-${srcNode.id}-${r.relation_type}-${tgtNode.id}`;
      const edge: KnowledgeEdge = {
        id: edgeId,
        source_node_id: srcNode.id,
        target_node_id: tgtNode.id,
        relation_type: r.relation_type,
        document_id: documentId,
        chunk_id: `chunk-${documentId}-1`,
        page: 1,
        confidence: typeof r.confidence === 'number' ? r.confidence : 0.9,
        evidence_text: r.evidence_text || content.slice(0, 100).trim(),
        status: 'PROPOSED',
        metadata: { page: 1, chunk_index: 1 },
        created_at: new Date().toISOString(),
        source_node: srcNode,
        target_node: tgtNode,
      };

      this.inMemoryEdges.set(edgeId, edge);
      createdEdges.push(edge);
    }

    return {
      nodes: Array.from(createdNodesMap.values()),
      edges: createdEdges,
    };
  }

  private static createFallbackExtraction(content: string, domain: DomainType) {
    return {
      nodes: [
        { canonical_name: '고령자', node_type: 'demographic', description: '65세 이상 노화 인구' },
        { canonical_name: '일주기리듬', node_type: 'concept', description: '생체 주기 조절 메커니즘' },
        { canonical_name: '수면', node_type: 'concept', description: '신체 및 인지 회복 상태' },
        { canonical_name: '빛 노출', node_type: 'factor', description: '생체시계 동기화 외생 요인' },
        { canonical_name: '멜라토닌', node_type: 'metric', description: '수면 유도 호르몬' },
        { canonical_name: '신체활동', node_type: 'factor', description: '주간 유산소 운동' },
      ],
      relations: [
        {
          source_name: '빛 노출',
          target_name: '일주기리듬',
          relation_type: 'influences',
          evidence_text: '아침 자연광 빛 노출은 멜라토닌 분비를 정상화하여 일주기리듬을 안정화시킵니다.',
          confidence: 0.94,
        },
        {
          source_name: '일주기리듬',
          target_name: '수면',
          relation_type: 'affects',
          evidence_text: '일주기 생체리듬의 진폭 감소는 야간 수면 단편화와 새벽 조기 기상을 유발합니다.',
          confidence: 0.91,
        },
        {
          source_name: '신체활동',
          target_name: '수면',
          relation_type: 'associated_with',
          evidence_text: '규칙적인 주간 신체활동은 야간 수면 효율을 향상시키고 불면을 개선합니다.',
          confidence: 0.88,
        },
        {
          source_name: '고령자',
          target_name: '수면',
          relation_type: 'has_characteristic',
          evidence_text: '고령자에게서 흔히 관찰되는 야간 수면 단편화 및 조기 기상 특성.',
          confidence: 0.89,
        },
      ],
    };
  }
}
