import { TxtParser } from '../lib/parsers/txt-parser';
import { MdParser } from '../lib/parsers/md-parser';
import { DocumentChunker } from '../lib/chunking/chunker';
import { TextCleaner } from '../lib/chunking/text-cleaner';

async function testPhase3() {
  console.log('=== PHASE 3 파서 및 청킹 엔진 테스트 시작 ===\n');

  // 1. Text Cleaner 테스트
  const dirtyText = "고령자   건강관리\t\t가이드라인입니다.\n\n\n\n수면은 최소   7시간을 권장합니다.   \n\n";
  const cleaned = TextCleaner.clean(dirtyText);
  console.log('1. [TextCleaner 결과]:');
  console.log(JSON.stringify(cleaned));
  console.assert(!cleaned.includes('\t\t'), '탭 제거 실패');
  console.assert(!cleaned.includes('\n\n\n'), '반복 줄바꿈 축소 실패');
  console.log('   ✓ TextCleaner 정상 통과\n');

  // 2. TXT 및 MD 파서 테스트
  const sampleMd = `# 고령자 양생법 개요
노년기의 양생(養生)은 무리한 활동을 피하고 기혈(氣血)을 조화롭게 보존하는 것이 핵심입니다.

## 1. 식이 양생
소화가 잘되는 따뜻한 음식을 주로 섭취하며 과식을 엄금합니다.

## 2. 수면 양생
일찍 자고 일찍 일어나는 조와조기(早臥早起)의 습관을 지킵니다.
`;
  const mdParser = new MdParser();
  const mdResult = await mdParser.parse(Buffer.from(sampleMd, 'utf-8'), 'sample.md');
  console.log('2. [MdParser 결과]:');
  console.log(`   총 텍스트 길이: ${mdResult.totalText.length}자, 페이지 수: ${mdResult.pages.length}`);
  console.assert(mdResult.totalText.includes('식이 양생'), '내용 파싱 오류');
  console.log('   ✓ MdParser 정상 통과\n');

  // 3. DocumentChunker 슬라이딩 윈도우 & 메타데이터 테스트
  const chunker = new DocumentChunker({ chunkSize: 100, chunkOverlap: 20 });
  const chunks = chunker.createChunks(
    [
      { pageNumber: 1, text: mdResult.totalText },
      { pageNumber: 2, text: '2페이지 보충 내용: 계절별 환절기 체온 조절은 혈관 질환 예방에 결정적입니다.' },
    ],
    'doc-test-123',
    'proj-test-456',
    { domain: 'yangsaeng', source: '동의보감' }
  );

  console.log('3. [DocumentChunker 결과]:');
  console.log(`   생성된 청크 총 개수: ${chunks.length}개`);
  chunks.forEach((c) => {
    console.log(`   [Chunk #${c.chunk_index}] (Page ${c.metadata.page}, 토큰추정 ${c.token_count}): ${c.content.substring(0, 35)}...`);
  });

  console.assert(chunks.length >= 2, '청크 분할 실패');
  console.assert(chunks[0].metadata.page === 1, '페이지 메타데이터 누락');
  console.assert(chunks[chunks.length - 1].metadata.page === 2, '2페이지 메타데이터 누락');
  console.log('   ✓ DocumentChunker 슬라이딩 및 페이지 보존 정상 통과\n');

  console.log('=== 모든 PHASE 3 컴포넌트 검증 성공! ===');
}

testPhase3().catch(console.error);
