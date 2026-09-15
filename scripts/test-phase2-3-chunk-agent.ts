import { ChunkingAgent } from '../services/chunking-agent/chunking-agent';
import { ChunkAgentTools } from '../services/chunking-agent/tools';
import { CHUNK_AGENT_PROMPT_VERSION } from '../services/chunking-agent/prompts/chunk-agent';

async function runPhase2And3Tests() {
  console.log('===============================================================');
  console.log('🧪 [PHASE 2 & 3] Agent-assisted Chunking & RAG Indexing Suite');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (detail) console.error(`   Details: ${detail}`);
      failed++;
    }
  }

  // 1. 프롬프트 버전 관리
  console.log('--- 1. 프롬프트 버전 관리 ---');
  assert(
    CHUNK_AGENT_PROMPT_VERSION === 'chunk_agent_v1',
    'TEST 1: Chunk Agent 프롬프트 버전이 chunk_agent_v1으로 정의됨'
  );

  // 2. 세션 초기화 및 초기 Chunk Proposal 생성
  console.log('\n--- 2. 세션 초기화 및 구조 분석 검증 ---');
  const testDocId = 'doc-test-agent-001';
  const { session, proposals } = await ChunkingAgent.initSession(testDocId);

  assert(
    session.status === 'ACTIVE' && session.document_id === testDocId,
    'TEST 2.1: 청킹 에이전트 세션이 ACTIVE 상태로 초기화됨'
  );
  assert(
    proposals.length >= 2,
    `TEST 2.2: 문서 구조로부터 초기 청크 제안 생성됨 (${proposals.length}개)`,
    `count: ${proposals.length}`
  );
  assert(
    session.chat_history.length >= 1 && session.chat_history[0].role === 'assistant',
    'TEST 2.3: 에이전트가 초기 제안 웰컴 메시지를 제시함'
  );

  // 3. ChunkAgentTools 실행 검증
  console.log('\n--- 3. Chunking Agent Toolset 검증 ---');
  const structure = await ChunkAgentTools.analyzeDocumentStructure(testDocId);
  assert(
    structure.length > 0 && typeof structure[0].tokenCount === 'number',
    'TEST 3.1: analyzeDocumentStructure()가 섹션 트리 및 토큰 분포 반환'
  );

  const planSummary = await ChunkAgentTools.previewChunkPlan(testDocId);
  assert(
    planSummary.totalProposals === proposals.length,
    'TEST 3.2: previewChunkPlan()이 총 청크 수 및 토큰 통계 요약'
  );

  // Tool: splitSection
  const initialCount = proposals.length;
  const targetToSplit = proposals[0];
  const splitResult = await ChunkAgentTools.splitSection(testDocId, targetToSplit.id, [
    '소주제 1: 생체리듬 기전',
    '소주제 2: 멜라토닌 분비',
  ]);
  assert(
    splitResult.length === initialCount + 1,
    `TEST 3.3: splitSection()으로 1개 청크를 2개로 분할 (+1개 증가 확인, 현재: ${splitResult.length}개)`
  );

  // Tool: mergeChunks
  const mergeTargets = [splitResult[0].id, splitResult[1].id];
  const mergedResult = await ChunkAgentTools.mergeChunks(testDocId, mergeTargets, '통합 생체리듬 및 멜라토닌');
  assert(
    mergedResult.length === initialCount,
    `TEST 3.4: mergeChunks()로 2개 청크를 1개로 병합 (원래 개수로 복원: ${mergedResult.length}개)`
  );

  // Tool: renameChunk & changeChunkCategory
  const renamed = await ChunkAgentTools.renameChunk(testDocId, mergedResult[0].id, '새로 수정된 제목');
  assert(
    renamed.title === '새로 수정된 제목' && renamed.status === 'EDITED',
    'TEST 3.5: renameChunk()로 제목 변경 및 EDITED 상태 전이'
  );

  const recategorized = await ChunkAgentTools.changeChunkCategory(testDocId, mergedResult[0].id, '일주기리듬 > 빛치료');
  assert(
    recategorized.category === '일주기리듬 > 빛치료',
    'TEST 3.6: changeChunkCategory()로 카테고리 변경'
  );

  // 4. Agent Chat 자연어 명령 처리 검증
  console.log('\n--- 4. Agent Chat 자연어 명령 라우팅 검증 ---');
  const chatReply = await ChunkingAgent.chat(testDocId, '이대로 승인해줘');
  assert(
    chatReply.assistantMessage.content.includes('승인'),
    'TEST 4.1: "이대로 승인해줘" 메시지에 대해 전체 APPROVED 승격 및 확인 응답 생성'
  );

  const finalProposals = await ChunkAgentTools.getProposals(testDocId);
  const approvedAll = finalProposals.every((p) => p.status === 'APPROVED');
  assert(approvedAll, 'TEST 4.2: 모든 Proposal이 APPROVED 상태로 승격됨 확인');

  console.log('\n===============================================================');
  console.log(`📊 [PHASE 2 & 3 결과] 총 ${passed + failed}개 테스트 중 ${passed}개 통과 / ${failed}개 실패`);
  console.log('===============================================================');

  if (failed > 0) process.exit(1);
}

runPhase2And3Tests().catch((e) => {
  console.error('테스트 실패:', e);
  process.exit(1);
});
