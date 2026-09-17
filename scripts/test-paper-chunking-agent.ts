import { InitialChunkDesigner } from '../services/chunking-agent/initial-designer';
import { ChunkingAgent } from '../services/chunking-agent/chunking-agent';
import { ChunkAgentTools } from '../services/chunking-agent/tools';
import { DocumentProfile } from '../types/rag';

async function runPaperChunkingTest() {
  console.log('===============================================================');
  console.log('📄 [TEST] Academic Paper Multi-Step LLM Chunking & Agent Chat');
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

  const paperDocId = 'paper-test-chronobiology-001';
  const paperDoc = {
    id: paperDocId,
    title: '고령자의 일주기 생체시계 교란과 수면 위생 개선을 위한 비약물적 중재 효과 분석',
    metadata: {
      category: '일주기리듬',
      document_type: '학술논문',
    },
  };

  const parsedPages = [
    {
      pageNumber: 1,
      text: `[초록]
본 연구는 고령자 집단에서 나타나는 24시간 일주기 생체리듬의 진폭 저하와 수면 장애의 상관관계를 규명하고, 아침 자연광 노출 및 수면 위생 프로토콜의 임상적 개선 효과를 무작위 대조군 연구로 검증하였다.

[서론: 고령화와 일주기 생체시계 퇴행]
인간의 뇌 시교차상핵(SCN)은 신체 내 모든 말초 조직의 생체시계를 동기화하는 중앙 중추이다. 그러나 노화가 진행됨에 따라 SCN의 신경세포 탈락과 멜라토닌 수용체 발현 감소로 일주기리듬의 위상 전진(Phase Advance)과 진폭 감쇠가 일어난다. 기존 선행연구들은 이러한 신경생리학적 변화가 야간의 잦은 각성과 주간 졸림증을 유발함을 보고하였다.

[연구 방법: 피험자 선정 및 생체신호 측정]
만 65세 이상 남녀 60명을 대상으로 실험군 30명과 대조군 30명으로 무작위 배정하였다. 실험군은 매일 오전 8시부터 45분간 5,000 Lux의 고조도 광치료와 온수 족욕을 병행하였다. 수면 평가는 4주간 수면일지, 손목 액티그래피(Actiwatch), 그리고 타액 멜라토닌 분비 개시 시점(DLMO)을 매주 측정하여 분석하였다.

[연구 결과: 수면 효율 및 멜라토닌 분비 정상화]
4주간의 중재 후 실험군의 수면 효율(Sleep Efficiency)은 기저치 71.3%에서 84.8%로 유의미하게 향상되었다(p < 0.001). 반면 대조군은 72.1%에서 73.0%로 통계적 차이가 없었다. 또한 실험군의 야간 DLMO 시간은 평균 42분 지연되어 정상 생체 위상으로 재동기화(Entrainment)되었음을 확인하였다.

[고찰: 한의학적 양생 및 광생물학적 기전 융합]
본 연구의 결과는 전통 한의학의 천인상응(天人相應) 및 일출이기(日出而起) 기전이 현대 크로노바이올로지(Chronobiology)의 광수용체(ipRGC) 자극 경로와 정확히 일치함을 시사한다. 특히 부작용 위험이 높은 수면제 투약 없이 일주기 리듬 회복만으로 수면 구조가 개선된 점은 임상적으로 중대한 가치가 있다.

[결론 및 제언]
고령자 대상 복합 일주기 중재 프로그램은 수면 분절을 억제하고 삶의 질을 높이는 효과적이고 안전한 비약물적 치료 프로토콜로 활용될 수 있다.`,
    },
  ];

  const profile: DocumentProfile = {
    document_id: paperDocId,
    domain: 'circadian',
    document_type: '학술논문',
    summary_short: '고령자 일주기 생체리듬 회복 및 수면 개선을 위한 비약물적 광치료 효과 연구',
    summary_full: '65세 이상 고령자를 대상으로 5,000 Lux 광치료 중재를 시행하여 수면 효율과 멜라토닌 DLMO 위상을 유의하게 개선한 임상 연구 논문.',
    topics: ['일주기리듬', '고령자 수면장애', '광치료', 'DLMO', '수면 효율'],
    concepts: ['시교차상핵(SCN)', '멜라토닌', 'DLMO', '액티그래피', '위상 전진'],
    keywords: ['일주기리듬', '고령자', '광치료', '수면위생', '멜라토닌'],
    target_population: ['65세 이상 고령자'],
    diseases: ['불면증', '일주기리듬 수면-각성장애'],
    health_metrics: ['수면 효율(%)', 'DLMO(시간)', 'WASO(분)'],
    lifestyle_factors: ['오전 고조도 자연광 노출', '온수 족욕'],
    categories: ['일주기리듬 > 광치료', '일주기리듬 > 수면위생'],
    structure: [
      { title: '초록', level: 1 },
      { title: '서론: 고령화와 일주기 생체시계 퇴행', level: 1 },
      { title: '연구 방법: 피험자 선정 및 생체신호 측정', level: 1 },
      { title: '연구 결과: 수면 효율 및 멜라토닌 분비 정상화', level: 1 },
      { title: '고찰: 한의학적 양생 및 광생물학적 기전 융합', level: 1 },
      { title: '결론 및 제언', level: 1 },
    ],
    candidate_entities: [],
    cross_domain_connections: [],
    llm_model: 'mock-intelligence-v1',
    prompt_version: 'document_profile_v1',
    profile_version: 'v1',
    status: 'PROPOSED',
  };

  // 1. 다단계 LLM 청크 설계 검증
  console.log('--- 1. 다단계 LLM 청크 설계자(InitialChunkDesigner) 실행 검증 ---');
  const designResult = await InitialChunkDesigner.design(
    paperDocId,
    paperDoc,
    parsedPages,
    profile
  );

  assert(
    designResult.proposals.length >= 4,
    `TEST 1.1: 논문에서 최소 4개 이상의 세부 청크 제안 생성 (생성된 청크 수: ${designResult.proposals.length}개)`
  );

  const distinctCategories = Array.from(
    new Set(designResult.proposals.map((p) => p.category).filter((c): c is string => Boolean(c)))
  );
  console.log('   발견된 청크 카테고리 목록:', distinctCategories);

  assert(
    distinctCategories.length >= 3,
    `TEST 1.2: 모든 청크가 '서론'으로 몰리지 않고 다중 카테고리로 분산됨 (카테고리 수: ${distinctCategories.length}개)`
  );

  const hasNonIntro = distinctCategories.some((c) =>
    c.includes('방법') || c.includes('결과') || c.includes('고찰') || c.includes('결론') || c.includes('초록')
  );
  assert(
    hasNonIntro,
    'TEST 1.3: 초록, 연구방법, 연구결과, 고찰, 결론 중 1개 이상의 전문 섹션 카테고리 식별'
  );

  assert(
    designResult.welcomeMessage.includes('다단계') || designResult.welcomeMessage.includes('설계'),
    'TEST 1.4: 에이전트 웰컴 브리핑에 다단계 분석 및 청크 설계 요약이 명시됨'
  );

  // 2. 세션 초기화 및 청크 저장
  console.log('\n--- 2. 세션 초기화 및 DB/메모리 저장 검증 ---');
  await ChunkAgentTools.saveProposals(paperDocId, designResult.proposals);
  const loadedProposals = await ChunkAgentTools.getProposals(paperDocId);

  assert(
    loadedProposals.length === designResult.proposals.length,
    `TEST 2.1: 제안된 ${loadedProposals.length}개의 청크가 성공적으로 저장 및 조회됨`
  );

  // 3. 에이전트 대화 및 실시간 청크 데이터 변이 검증
  console.log('\n--- 3. 대화를 통한 실시간 청크 데이터 변이 검증 ---');

  // TEST 3.1: 카테고리 변경 요청
  const chat1 = await ChunkingAgent.chat(paperDocId, '3번부터 4번까지 연구방법으로 변경해줘');
  const p3 = chat1.proposals.find((p) => p.proposed_index === 3);
  const p4 = chat1.proposals.find((p) => p.proposed_index === 4);

  assert(
    p3?.category === '연구방법' && p4?.category === '연구방법',
    'TEST 3.1: "3번부터 4번까지 연구방법으로 변경해줘" 요청 시 청크 #3, #4의 카테고리가 연구방법으로 실제 변이됨'
  );
  assert(
    p3?.status === 'EDITED' && p4?.status === 'EDITED',
    'TEST 3.2: 수정된 청크의 상태(status)가 EDITED로 업데이트됨'
  );

  // TEST 3.3: 제목 변경 요청
  const chat2 = await ChunkingAgent.chat(paperDocId, '2번 청크 제목 "생체시계 교란 기전"으로 변경해줘');
  const p2 = chat2.proposals.find((p) => p.proposed_index === 2);
  assert(
    p2?.title === '생체시계 교란 기전',
    `TEST 3.3: "2번 청크 제목 생체시계 교란 기전으로 변경해줘" 요청 시 제목이 실제 변이됨 (현재: ${p2?.title})`
  );

  // TEST 3.4: 승인 요청
  const chat3 = await ChunkingAgent.chat(paperDocId, '이대로 승인해줘');
  const allApproved = chat3.proposals.every((p) => p.status === 'APPROVED');
  assert(
    allApproved,
    'TEST 3.4: "이대로 승인해줘" 대화 요청 시 모든 청크가 APPROVED 상태로 승격됨'
  );

  console.log('\n===============================================================');
  console.log(`📊 [논문 청킹 테스트 결과] 총 ${passed + failed}개 중 ${passed}개 통과 / ${failed}개 실패`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPaperChunkingTest().catch((err) => {
  console.error('Fatal Error in runPaperChunkingTest:', err);
  process.exit(1);
});
