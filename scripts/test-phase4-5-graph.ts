/**
 * PHASE 4 & 5 Verification Script:
 * Knowledge Graph Extraction, Strict Provenance, Normalization,
 * Category Hierarchy & Cross-Domain Fabric Bridges
 *
 * Execution:
 * npx tsx scripts/test-phase4-5-graph.ts
 */

import { GraphExtractor } from '../services/knowledge-graph/extractor';
import { EntityNormalizer } from '../services/knowledge-graph/normalizer';
import { KnowledgeFabricService } from '../services/knowledge-graph/fabric-service';
import { DOMAIN_CONFIGS, DomainType } from '../types/rag';

async function runPhase4and5Tests() {
  console.log('====================================================');
  console.log('🚀 Phase 4 & 5: Knowledge Graph & Fabric Verification');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // TEST 1: Entity Normalizer alias & canonical resolution
  console.log('\n[Test 1] Entity Normalizer');
  const sleepNorm = EntityNormalizer.normalize('수면 상태', 'circadian');
  assert(sleepNorm.canonicalName === '수면', '수면 상태 -> 수면 (Canonical mapping)');
  assert(sleepNorm.aliases.includes('수면상태') || sleepNorm.aliases.includes('잠'), 'Alias list includes variations');

  const bpNorm = EntityNormalizer.normalize('혈압', 'health');
  assert(bpNorm.canonicalName === '수축기 혈압', '혈압 -> 수축기 혈압 (Canonical mapping)');

  const yangsaengNorm = EntityNormalizer.normalize('기거양생', 'yangsaeng');
  assert(yangsaengNorm.canonicalName === '조와조기', '기거양생 -> 조와조기');

  // TEST 2: Knowledge Graph Extraction from Document
  console.log('\n[Test 2] Graph Extractor on Document Content');
  const testDocId = 'doc-circadian-eval-001';
  const testContent = `
    제1장 고령자의 일주기 생체리듬과 수면
    아침 시간대의 자연광 및 햇빛 노출은 뇌의 시교차상핵(SCN)을 자극하여 일주기리듬을 24시간 주기로 동기화한다.
    일주기리듬이 정상적으로 동기화되면 야간의 멜라토닌 분비가 촉진되고 깊은 수면 단계가 연장된다.
    반대로 저녁 시간 스마트폰의 청색광 노출은 멜라토닌 분비를 억제하여 야간 각성을 유발하고 수면 효율을 급격히 저하시킨다.
    낮 시간대의 30분 유산소 신체활동은 야간 중심체온 하강을 도와 수면의 질을 개선하며, 고령자의 수축기 혈압 안정에도 기여한다.
  `;

  const { nodes, edges } = await GraphExtractor.extractGraphFromDocument(
    testDocId,
    testContent,
    'circadian'
  );

  assert(nodes.length >= 3, `Extracted ${nodes.length} nodes (>= 3 required)`);
  assert(edges.length >= 2, `Extracted ${edges.length} edges (>= 2 required)`);

  // TEST 3: Strict Provenance Checks
  console.log('\n[Test 3] Strict Provenance & Evidence Verification');
  let provenanceValid = true;
  for (const edge of edges) {
    if (!edge.evidence_text || edge.evidence_text.length < 5) {
      provenanceValid = false;
      console.warn(`    ⚠️ Missing evidence_text in edge: ${edge.id}`);
    }
    if (typeof edge.confidence !== 'number' || edge.confidence < 0 || edge.confidence > 1) {
      provenanceValid = false;
      console.warn(`    ⚠️ Invalid confidence in edge: ${edge.confidence}`);
    }
    if (!edge.document_id) {
      provenanceValid = false;
      console.warn(`    ⚠️ Missing document_id in edge: ${edge.id}`);
    }
  }
  assert(provenanceValid, 'All extracted edges have strict provenance (document_id, confidence, evidence_text)');

  // TEST 4: Human-in-the-loop Edge Approval / Rejection
  console.log('\n[Test 4] Human-in-the-loop Edge Status Transition');
  if (edges.length > 0) {
    const firstEdge = edges[0];
    assert(firstEdge.status === 'PROPOSED', 'New edges start in PROPOSED status');

    const approvedEdge = await GraphExtractor.updateEdgeStatus(testDocId, firstEdge.id, 'APPROVED');
    assert(approvedEdge?.status === 'APPROVED', 'Edge status successfully transitioned to APPROVED');

    const rejectedEdge = await GraphExtractor.updateEdgeStatus(testDocId, firstEdge.id, 'REJECTED');
    assert(rejectedEdge?.status === 'REJECTED', 'Edge status successfully transitioned to REJECTED');
  } else {
    assert(false, 'Edge status update test skipped due to zero extracted edges');
  }

  // TEST 5: Category Hierarchy Tree Retrieval across Domains
  console.log('\n[Test 5] Category Hierarchy Tree (Knowledge Fabric)');
  const allCategoryRoots = await KnowledgeFabricService.getCategoryTree();
  assert(allCategoryRoots.length >= 4, `Category roots across all domains >= 4 (Found: ${allCategoryRoots.length})`);

  const circadianRoots = await KnowledgeFabricService.getCategoryTree('circadian');
  assert(circadianRoots.length >= 1, `Circadian roots found (${circadianRoots.length})`);
  assert(circadianRoots[0].children !== undefined && circadianRoots[0].children.length > 0, 'Circadian L1 category has L2 child categories');

  // Verify 4 domains coverage
  const domains: DomainType[] = ['health', 'yangsaeng', 'circadian', 'korean-medicine'];
  for (const dom of domains) {
    const domTree = await KnowledgeFabricService.getCategoryTree(dom);
    assert(domTree.length > 0, `Domain [${DOMAIN_CONFIGS[dom].shortName}] has category tree`);
  }

  // TEST 6: Cross-domain Bridges
  console.log('\n[Test 6] Cross-domain Bridges (4대 도메인 교차 연결)');
  const bridges = await KnowledgeFabricService.getCrossDomainBridges();
  assert(bridges.length >= 4, `Cross-domain bridges found: ${bridges.length} (>= 4 expected)`);

  const coveredDomains = new Set<DomainType>();
  bridges.forEach((b) => {
    coveredDomains.add(b.sourceDomain);
    coveredDomains.add(b.targetDomain);
  });
  assert(coveredDomains.has('health') && coveredDomains.has('circadian') && coveredDomains.has('yangsaeng') && coveredDomains.has('korean-medicine'),
    'Bridges connect all 4 domains (health, circadian, yangsaeng, korean-medicine)');

  for (const b of bridges) {
    assert(b.rationale.length > 10, `Bridge "${b.concept}" has scientific/traditional rationale: "${b.rationale.slice(0, 35)}..."`);
  }

  // TEST 7: Global Fabric Graph Assembly
  console.log('\n[Test 7] Global Fabric Graph Assembly');
  const globalFabric = await KnowledgeFabricService.getGlobalFabricGraph();
  assert(globalFabric.nodes.length >= 8, `Global fabric contains ${globalFabric.nodes.length} nodes (>= 8)`);
  assert(globalFabric.edges.length >= 3, `Global fabric contains ${globalFabric.edges.length} edges (>= 3)`);
  assert(globalFabric.bridges.length >= 4, `Global fabric contains ${globalFabric.bridges.length} bridges (>= 4)`);

  const filteredCircadianFabric = await KnowledgeFabricService.getGlobalFabricGraph('circadian');
  assert(filteredCircadianFabric.nodes.every((n) => n.domain === 'circadian'), 'Filtered fabric nodes only contain requested domain');

  // SUMMARY
  console.log('\n====================================================');
  console.log(`📊 Phase 4 & 5 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase4and5Tests().catch((err) => {
  console.error('Fatal error during Phase 4 & 5 test execution:', err);
  process.exit(1);
});
