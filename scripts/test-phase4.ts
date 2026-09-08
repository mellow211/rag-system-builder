import { getEmbeddingProvider } from '../lib/embedding';
import { MockEmbeddingProvider } from '../lib/embedding/mock-provider';

async function testPhase4() {
  console.log('=== PHASE 4 임베딩 어댑터 및 벡터 검증 시작 ===\n');

  const provider = getEmbeddingProvider();
  console.log(`1. 활성화된 프로바이더: ${provider.providerName} (${provider.modelName})`);
  console.log(`   벡터 차원: ${provider.dimension}차원`);
  console.assert(provider.dimension === 1536, '1536차원 불일치');

  // 단일 임베딩 테스트
  const text1 = '고령자의 적절한 수면 시간은 7~8시간이며 규칙적인 기상이 권장됩니다.';
  const text2 = '노인의 충분한 수면 관리와 일주기리듬 유지 가이드.';
  const text3 = '전통 한의학의 사상체질 진단과 문진 평가 지표.';

  console.log('\n2. 텍스트 임베딩 생성 중...');
  const vec1 = await provider.embedText(text1);
  const vec2 = await provider.embedText(text2);
  const vec3 = await provider.embedText(text3);

  console.log(`   vec1 길이: ${vec1.length}, 첫 3개 값: [${vec1.slice(0, 3).join(', ')}]`);
  console.assert(vec1.length === 1536, '임베딩 차원 1536 아님');

  // L2 Norm 검증 (단위 벡터 확인: dot product = cosine similarity)
  const norm1 = Math.sqrt(vec1.reduce((sum, v) => sum + v * v, 0));
  console.log(`   vec1 L2 Norm: ${norm1.toFixed(4)} (1.0000에 수렴해야 함)`);
  console.assert(Math.abs(norm1 - 1.0) < 0.05, 'L2 정규화 실패');

  // 코사인 유사도 계산 (내적)
  const cosineSim = (a: number[], b: number[]) => a.reduce((sum, val, i) => sum + val * b[i], 0);

  const sim12 = cosineSim(vec1, vec2);
  const sim13 = cosineSim(vec1, vec3);

  console.log(`\n3. [코사인 유사도 비교]:`);
  console.log(`   - "수면 시간" vs "수면 관리": 유사도 ${sim12.toFixed(4)}`);
  console.log(`   - "수면 시간" vs "한의학 체질": 유사도 ${sim13.toFixed(4)}`);

  console.log('\n=== PHASE 4 임베딩 어댑터 검증 성공! ===');
}

testPhase4().catch(console.error);
