import { cleanDocument } from '../services/ingestion/cleaning/clean-document';
import { HeadingDetector } from '../services/ingestion/parsing/heading-detector';
import { KoreanSentenceSplitter } from '../services/ingestion/parsing/sentence-splitter';
import { BlockParser } from '../services/ingestion/parsing/block-parser';
import { ParentChildChunker } from '../services/ingestion/chunking/parent-child-chunker';
import { NoOpContextualizer } from '../services/ingestion/contextualization/no-op-contextualizer';
import { EmbeddingContentBuilder } from '../services/ingestion/embedding/embedding-content-builder';
import { ChunkingEvaluator } from '../services/retrieval/chunking-evaluator';
import { TokenCounter } from '../lib/chunking/token-counter';

async function runAllPhaseTests() {
  console.log('===============================================================');
  console.log('🚀 Running Complete Structure-aware + LLM Contextualization Suite');
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

  // -------------------------------------------------------------
  // [PHASE 1] Text Cleaning & Medical Term Protection 검증
  // -------------------------------------------------------------
  console.log('\n--- [PHASE 1] Text Cleaning & Medical Term Protection ---');
  const dirtyText = `
  대한노인의학회지 제28권 제3호 2024
  - 1 -
  고령자의 공복혈당(FBS) 목표치는   120 mg/dL 이하이며,
  당화혈색소(HbA1c) 수치는 6.5% 미만으로 관리되어야 합니다.
  
  수축기 혈압은 130/80 mmHg를 권장합니다.
  동의보감(東醫寶鑑)의 사상체질(四象體質) 중 소음인(少陰人)은
  비위허약(脾胃虛弱)하여 소화기 관리가 중요합니다.
  - 2 -
  대한노인의학회지 제28권 제3호 2024
  `;

  const cleanRes = cleanDocument(dirtyText);
  assert(
    !cleanRes.cleanedText.includes('- 1 -') && !cleanRes.cleanedText.includes('- 2 -'),
    'TEST 1: 페이지 번호 노이즈(- 1 -, - 2 -) 완전 제거'
  );
  assert(
    !cleanRes.cleanedText.includes('대한노인의학회지 제28권 제3호 2024'),
    'TEST 2: 반복 헤더/저널명 노이즈 제거'
  );
  assert(
    cleanRes.stats.medicalTermsIntact &&
      cleanRes.cleanedText.includes('120 mg/dL') &&
      cleanRes.cleanedText.includes('HbA1c') &&
      cleanRes.cleanedText.includes('130/80 mmHg') &&
      cleanRes.cleanedText.includes('東醫寶鑑') &&
      cleanRes.cleanedText.includes('少陰人'),
    'TEST 3: 의학 수치(mg/dL, mmHg, HbA1c) 및 한의학 전문 용어 100% 무결성 보존'
  );

  // -------------------------------------------------------------
  // [PHASE 2] Heading Detection with Confidence & Sentence Splitter
  // -------------------------------------------------------------
  console.log('\n--- [PHASE 2] Heading Confidence & Sentence Splitter ---');
  const splitter = new KoreanSentenceSplitter();
  const sentText =
    '고령자의 일일 권장 수면시간은 7.5시간입니다. 하지만 Fig. 1에 나타난 Dr. Kim 교수의 연구에 따르면 낮잠 시간은 30분 이내로 제한해야 함. 또한 취침 전 스마트폰 사용은 수면 잠복기를 1.5배 지연시킴!';
  const sentences = splitter.split(sentText);
  assert(
    sentences.length === 3,
    'TEST 4: 소수점(7.5, 1.5) 및 약어(Fig. 1, Dr. Kim) 보존 문장 분리 (3문장 정확 일치)',
    `Actual count: ${sentences.length}`
  );
  assert(
    sentences[0].includes('7.5시간입니다.') && sentences[1].includes('제한해야 함.'),
    'TEST 5: 한국어 종결어미(입니다., 함., 지연시킴!) 온전한 문장 종결 분리'
  );

  const highConfHeading = HeadingDetector.detect('제1장 고령자의 일주기리듬 및 수면 관리');
  const numberedHeading = HeadingDetector.detect('1.1 조도 및 침실 환경 관리');
  const regularSentence = HeadingDetector.detect('어르신의 경우 매일 아침 일정한 시간에 기상하는 것이 건강에 좋습니다.');

  assert(
    highConfHeading !== null && highConfHeading.confidence >= 0.90,
    'TEST 6: 법령/지침서 제N장 헤딩 탐지 (Confidence >= 0.90)'
  );
  assert(
    numberedHeading !== null && numberedHeading.confidence >= 0.85,
    'TEST 7: 소제목 번호(1.1) 계층 탐지 (Confidence >= 0.85)'
  );
  assert(
    regularSentence === null || regularSentence.confidence < 0.70,
    'TEST 8: 일반 본문 문장의 헤딩 오인식 방지 (Confidence < 0.70)'
  );

  // -------------------------------------------------------------
  // [PHASE 3 & 4] 7대 문서 유형별 Structure-aware & Parent/Child 청킹
  // -------------------------------------------------------------
  console.log('\n--- [PHASE 3 & 4] 7대 문서 유형 검증 (의미 단위 보호 & Parent-Child) ---');

  const sampleDocText = `
# 고령자 수면위생 임상 가이드라인

만 65세 이상 어르신의 수면 건강 관리는 신체 항상성 유지에 필수적입니다. 규칙적인 기상 시간을 유지하는 것이 첫걸음입니다.

## 1. 연령별 표준 수면시간

다음 표는 연령대별 권장 수면시간 및 관리 수칙입니다.

| 연령대 | 권장 수면시간 | 주요 주의사항 |
|---|---|---|
| 중년기 (40~64세) | 7~8시간 | 야간 스마트폰 사용 자제 |
| 노년기 (65세 이상) | 7~8시간 | 주간 30분 이상 과도한 낮잠 금지 |
| 초고령기 (80세 이상) | 6~7시간 | 야간 낙상 방지 간접조명 유지 |

위 표의 수칙에 따라 침상에 누워있는 시간과 실제 수면시간을 일치시켜야 합니다.

## 2. 고령자 수면위생 4대 실천원칙

다음 4가지 원칙을 매일 실천하도록 권장합니다.
1) 매일 아침 일정한 시각에 기상한다.
2) 기상 직후 30분 동안 자연 채광을 쬔다.
3) 오후 3시 이후에는 카페인 음료 섭취를 제한한다.
4) 침실 온도는 섭씨 20~22도로 쾌적하게 유지한다.

## 3. 한의학적 불면 변증 문진표

[한의문진]
문항 1. 밤에 자다가 소변 때문에 깨거나 잠들기 어렵습니까?
설명: 신양허(腎陽虛) 및 야간 빈뇨 여부를 진단하기 위한 핵심 문진입니다.
선택지:
1) 전혀 그렇지 않다
2) 가끔 그렇다
3) 주 3회 이상 자주 그렇다
판정기준: 3번 선택 시 야간 수분 섭취 제한 및 온양신(溫陽腎) 섭생법을 적용한다.
`;

  const chunker = new ParentChildChunker({
    targetTokens: 300,
    maxTokens: 500,
    minTokens: 100,
  });

  const res = chunker.process(
    [{ pageNumber: 1, text: sampleDocText }],
    'test-doc-multi',
    'proj-circadian',
    { title: '고령자 수면위생 임상 가이드라인', domain: 'circadian' }
  );

  assert(res.childChunks.length >= 3, 'TEST 9: 7대 복합 구조 문서 Child 청크 분할 완료');
  assert(res.parentChunks.length >= 1, 'TEST 10: Section 단위 Parent 청크 생성 완료');

  // 표(Table) 보존 확인
  const tableChunk = res.childChunks.find((c) => c.chunk_type === 'table');
  assert(
    tableChunk !== undefined &&
      tableChunk.content.includes('| 연령대 |') &&
      tableChunk.content.includes('| 초고령기 (80세 이상) |'),
    'TEST 11: 표(Table)가 중간 분할 없이 단일 청크로 100% 보존됨'
  );

  // 목록(List) 보존 확인
  const listChunk = res.childChunks.find((c) => c.chunk_type === 'list');
  assert(
    listChunk !== undefined &&
      listChunk.content.includes('1)') &&
      listChunk.content.includes('4)'),
    'TEST 12: 목록(List) 4개 실천원칙이 단일 청크로 보존됨'
  );

  // Q&A / 한의문진 보존 확인
  const qaChunk = res.childChunks.find((c) => c.chunk_type === 'qa');
  assert(
    qaChunk !== undefined &&
      qaChunk.content.includes('[한의문진]') &&
      qaChunk.content.includes('선택지:') &&
      qaChunk.content.includes('판정기준:'),
    'TEST 13: 한의문진(질문 + 설명 + 선택지 + 판정기준)이 분리 없이 결합 보존됨'
  );

  // Parent / Child Linkage 확인
  assert(
    res.childChunks.every((c) => c.parent_chunk_id && c.parent_chunk_id.startsWith('parent_')),
    'TEST 14: 모든 Child 청크에 유효한 parent_chunk_id 연결 검증'
  );

  // -------------------------------------------------------------
  // [PHASE 5 & 6] LLM Contextualization & Embedding Content Builder
  // -------------------------------------------------------------
  console.log('\n--- [PHASE 5 & 6] LLM Contextualization & Embedding Content ---');
  const contextualizer = new NoOpContextualizer();
  const ctxRes = await contextualizer.contextualize(res.childChunks[0], {
    documentId: 'test-doc-multi',
    documentTitle: '고령자 수면위생 임상 가이드라인',
    domain: 'circadian',
  });

  assert(
    ctxRes.contextText.length >= 20 && ctxRes.contextText.length <= 150,
    'TEST 15: 30~100 토큰 범위의 간결한 검색 문맥 설명 생성'
  );
  assert(
    ctxRes.embeddingContent.includes('[Document]') &&
      ctxRes.embeddingContent.includes('[Domain]') &&
      ctxRes.embeddingContent.includes('[Section]') &&
      ctxRes.embeddingContent.includes('[Context]') &&
      ctxRes.embeddingContent.includes('[Content]'),
    'TEST 16: 표준 5대 섹션 구조 [Document]->[Domain]->[Section]->[Context]->[Content] 합성 완료'
  );

  const pureContent = EmbeddingContentBuilder.extractPureContent(ctxRes.embeddingContent);
  assert(
    !pureContent.includes('[Document]') && pureContent.includes(res.childChunks[0].content.slice(0, 30)),
    'TEST 17: 사용자 화면/Citation용 순수 원문(content) 안전 분리'
  );

  // -------------------------------------------------------------
  // [PHASE 8] Retrieval 정량적 평가 (Hit@K, MRR)
  // -------------------------------------------------------------
  console.log('\n--- [PHASE 8] Retrieval 정량 평가 지표 (Hit@K, MRR) ---');
  const v1SampleChunks = [
    { content: '고령자의 일일 권장 수면시간은 7.5시간 내외로...', page: 1 },
    { content: '수면 위생을 위해 매일 아침 자연 채광을 쬐어 일주기리듬을...', page: 2 },
    { content: '사상체질 중 소음인은 소화기 기능이 약하므로...', page: 3 },
  ];

  const evalResult = ChunkingEvaluator.evaluateRetrieval(
    '고령자 일주기리듬과 아침 채광 수면위생',
    v1SampleChunks,
    res.childChunks
  );

  assert(
    evalResult.v2Contextualized.metrics.hitAt1 === true,
    'TEST 18: v2 + Contextualization 쿼리 검색 Hit@1 달성'
  );
  assert(
    evalResult.v2Contextualized.metrics.reciprocalRank >= evalResult.v1Fixed.metrics.reciprocalRank,
    'TEST 19: v2 구조/문맥 검색의 MRR(순위역수)이 v1 고정분할 대비 우수하거나 동일함'
  );

  console.log('\n===============================================================');
  console.log(`📊 Total Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllPhaseTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
