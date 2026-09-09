import { StructureChunker } from '../lib/chunking/structure/structure-chunker';
import { SentenceSplitter } from '../lib/chunking/structure/sentence-splitter';
import { BlockParser } from '../lib/chunking/structure/block-parser';
import { TokenCounter } from '../lib/chunking/token-counter';

async function runTests() {
  console.log('====================================================');
  console.log('🚀 Running Structure-aware Chunking v2 Test Suite');
  console.log('====================================================\n');

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

  // TEST 1: Sentence Splitter with Korean verb endings & decimal protection
  const test1Text = '고령자의 일일 권장 수면시간은 7.5시간 내외입니다. 하지만 수면 유지가 어려울 때는 30분 이상 깨어있지 말아야 합니다! 또한 Dr. Kim 교수의 연구에 따르면 낮잠은 1.5배의 피로 회복 효과가 있음.';
  const sentences = SentenceSplitter.split(test1Text);
  assert(
    sentences.length === 3,
    'TEST 1: 문장 분리 (소수점 7.5, 1.5 및 약어 Dr. Kim 보호)',
    `Expected 3 sentences, got ${sentences.length}: ${JSON.stringify(sentences)}`
  );
  assert(
    sentences[0].includes('7.5시간 내외입니다.') && sentences[2].includes('1.5배의 피로 회복 효과가 있음.'),
    'TEST 1-1: 소수점이 문장 중간에서 잘리지 않음'
  );

  // TEST 2: Heading Detection & Section Hierarchy
  const test2Text = `# 제1장 고령자 수면관리
고령자의 수면 관리는 신체 항상성 유지에 매우 중요합니다.

## 1.1 수면 환경 개선
침실의 온도는 섭씨 20~22도로 유지해야 합니다.

### 1.1.1 조도 및 소음
야간 조명은 간접 조명을 활용하고 소음을 차단합니다.`;

  const chunker = new StructureChunker({ targetTokens: 200, maxTokens: 400 });
  const res2 = chunker.chunkDocument(
    [{ pageNumber: 1, text: test2Text }],
    'test-doc-1',
    'project-1',
    { title: '수면 지침서', domain: '일주기리듬' }
  );

  assert(res2.childChunks.length >= 1, 'TEST 2: 구조 인식 청킹 생성');
  const lastChunk = res2.childChunks[res2.childChunks.length - 1];
  assert(
    lastChunk.section_path.includes('제1장 고령자 수면관리') || lastChunk.section_title === '조도 및 소음',
    'TEST 2-1: 계층적 Section Path 및 Title 보존',
    `Section path: ${JSON.stringify(lastChunk.section_path)}, Title: ${lastChunk.section_title}`
  );

  // TEST 3: Semantic Unit Protection - Table Preservation
  const test3Text = `다음은 연령별 표준 수면시간 가이드입니다.

| 연령대 | 권장 수면시간 | 비고 |
|---|---|---|
| 청년기 (20~39세) | 7~8시간 | 심야 활동 주의 |
| 중년기 (40~64세) | 7시간 | 만성피로 관리 |
| 노년기 (65세 이상) | 7~8시간 | 침상 과류 금지 |

위 표의 수칙을 준수해야 합니다.`;

  const res3 = chunker.chunkDocument(
    [{ pageNumber: 1, text: test3Text }],
    'test-doc-2',
    'project-1'
  );

  const tableChunks = res3.childChunks.filter((c) => c.chunk_type === 'table');
  assert(tableChunks.length === 1, 'TEST 3: Markdown 표가 중간에서 쪼개지지 않고 단일 청크로 보존됨');
  assert(
    tableChunks[0].content.includes('| 청년기 (20~39세)') && tableChunks[0].content.includes('| 노년기 (65세 이상)'),
    'TEST 3-1: 표의 모든 행이 보존됨'
  );

  // TEST 4: Semantic Unit Protection - List Preservation
  const test4Text = `고령자 수면 위생 4대 원칙:
1) 매일 아침 일정한 시간에 기상한다.
2) 오전 10시 이전 30분간 자연광을 쬔다.
3) 오후 3시 이후 카페인 섭취를 금한다.
4) 침실은 오직 수면만을 위한 공간으로 사용한다.`;

  const res4 = chunker.chunkDocument(
    [{ pageNumber: 1, text: test4Text }],
    'test-doc-3',
    'project-1'
  );
  assert(res4.childChunks.some((c) => c.chunk_type === 'list'), 'TEST 4: List 타입 인식 및 통일 청킹');
  const listChunk = res4.childChunks.find((c) => c.chunk_type === 'list')!;
  assert(
    listChunk.content.includes('1)') && listChunk.content.includes('4)'),
    'TEST 4-1: 1번부터 4번까지 목록 항목이 한 청크에 보존됨'
  );

  // TEST 5: Semantic Unit Protection - Q&A Preservation
  const test5Text = `[Q&A 문진 항목]
Q: 밤에 자다가 소변 때문에 자주 깨는데 어떻게 해야 하나요?
A: 야간뇨는 고령자에게 흔하며 취침 2시간 전부터 수분 섭취를 제한하고 이뇨 작용이 있는 음료를 피해야 합니다.`;

  const res5 = chunker.chunkDocument(
    [{ pageNumber: 1, text: test5Text }],
    'test-doc-4',
    'project-1'
  );
  assert(res5.childChunks.some((c) => c.chunk_type === 'qa'), 'TEST 5: Q&A 블록 인식 및 분리 방지');
  const qaChunk = res5.childChunks.find((c) => c.chunk_type === 'qa')!;
  assert(
    qaChunk.content.includes('Q:') && qaChunk.content.includes('A:'),
    'TEST 5-1: 질문과 답변이 동일 청크에 안전하게 보존됨'
  );

  // TEST 6: Parent-Child Chunk Linkage
  assert(res2.parentChunks.length > 0, 'TEST 6: Section 단위 Parent Chunk 생성');
  const parent = res2.parentChunks[0];
  const childrenWithParent = res2.childChunks.filter((c) => c.parent_chunk_id === parent.id);
  assert(
    childrenWithParent.length > 0,
    'TEST 6-1: Child Chunk가 유효한 parent_chunk_id를 보유함',
    `Parent ID: ${parent.id}, Linked child count: ${childrenWithParent.length}`
  );

  // TEST 7: Embedding Content Context Enrichment
  const sampleChunk = res2.childChunks[0];
  assert(
    sampleChunk.embedding_content.includes('문서: 수면 지침서') &&
      sampleChunk.embedding_content.includes('분야: 일주기리듬') &&
      sampleChunk.embedding_content.includes('[본문]'),
    'TEST 7: Embedding Content에 Context Metadata(문서, 분야, 섹션, 페이지)가 정확히 합성됨'
  );
  assert(
    !sampleChunk.content.includes('문서: 수면 지침서'),
    'TEST 7-1: 사용자 표시용 content 원문은 순수 원문만을 유지함'
  );

  // TEST 8: Long Paragraph Sentence-level Splitting without Mid-sentence Cut
  const longPara = Array(15)
    .fill(0)
    .map((_, i) => `제${i + 1}조에 따라 고령자의 생체리듬 유지를 위한 수면 관리가 필수적으로 요구됩니다.`)
    .join(' ');
  const res8 = chunker.chunkDocument(
    [{ pageNumber: 2, text: longPara }],
    'test-doc-long',
    'project-1'
  );
  assert(res8.childChunks.length >= 2, 'TEST 8: 긴 문단이 문장 단위로 분할됨');
  const allEndWithPunctuation = res8.childChunks.every((c) => /[.!?]$/.test(c.content.trim()));
  assert(allEndWithPunctuation, 'TEST 8-1: 분할된 모든 청크가 완전한 문장 부호로 끝남 (중간 잘림 0건)');

  // TEST 9: Cross-page Boundary Sentence Handling
  const page1Text = '노년기 생체시계는 일조량에 민감하게 반응하므로 매일 아침 햇볕을 쬐는 습관은 멜라토닌 분비를 촉진하고';
  const page2Text = '야간 수면의 질을 획기적으로 개선하는 핵심 요인이 됩니다. 따라서 규칙적인 산책이 필수적입니다.';
  const res9 = chunker.chunkDocument(
    [
      { pageNumber: 1, text: page1Text },
      { pageNumber: 2, text: page2Text },
    ],
    'test-doc-cross-page',
    'project-1'
  );
  assert(res9.childChunks.length >= 1, 'TEST 9: 페이지 경계 문서 청킹 성공');
  const hasPageSpan = res9.childChunks.some((c) => c.page_start === 1 && c.page_end === 2);
  assert(hasPageSpan, 'TEST 9-1: 페이지 경계를 넘어선 청크의 page_start(1) 및 page_end(2) 추적 성공');

  console.log('\n====================================================');
  console.log(`📊 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
