import { MockLLMProvider } from '../services/llm/mock-provider';
import { getLLMProvider } from '../services/llm';
import {
  DOCUMENT_PROFILE_PROMPT_VERSION,
  DOCUMENT_PROFILE_SYSTEM_PROMPT,
  buildDocumentProfileUserPrompt,
  DOCUMENT_PROFILE_JSON_SCHEMA,
} from '../services/intelligence/prompts/document-profile';
import { ProfileCache } from '../services/intelligence/profile-cache';
import { DocumentProfiler } from '../services/intelligence/document-profiler';
import { DocumentProfile } from '../types/rag';

async function runPhase1Tests() {
  console.log('===============================================================');
  console.log('🧪 [PHASE 1] Document Intelligence 단위 및 통합 검증 테스트');
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

  // 1. 프롬프트 버전 관리 검증
  console.log('--- 1. 프롬프트 버전 관리 검증 ---');
  assert(
    DOCUMENT_PROFILE_PROMPT_VERSION === 'document_profile_v1',
    'TEST 1.1: Document Profile 프롬프트 버전이 document_profile_v1으로 관리됨'
  );

  const samplePrompt = buildDocumentProfileUserPrompt({
    title: '고령자의 수면과 일주기리듬',
    domain: 'circadian',
    source: '대한노인의학회',
    documentType: '가이드라인',
    contentSample: '노화에 따른 시교차상핵(SCN)의 신경세포 손실은 멜라토닌 분비 리듬을 교란합니다.',
  });
  assert(
    samplePrompt.includes('고령자의 수면과 일주기리듬') && samplePrompt.includes('circadian'),
    'TEST 1.2: buildDocumentProfileUserPrompt가 도메인 및 메타데이터를 올바르게 결합함'
  );

  // 2. LLM Provider Adapter & Structured Output 검증
  console.log('\n--- 2. LLM Provider Adapter & Schema 검증 ---');
  const provider = getLLMProvider('mock');
  assert(
    provider.providerName === 'mock',
    'TEST 2.1: LLMProvider 인터페이스 추상화 및 팩토리 동작 확인'
  );

  const generatedProfile = await provider.generateStructured<DocumentProfile>({
    systemPrompt: DOCUMENT_PROFILE_SYSTEM_PROMPT,
    prompt: samplePrompt,
    schemaName: 'DocumentProfile',
    schema: DOCUMENT_PROFILE_JSON_SCHEMA,
  });

  assert(
    typeof generatedProfile.summary_short === 'string' && generatedProfile.summary_short.length > 0,
    'TEST 2.2: summary_short(한 줄 요약) 생성 확인',
    generatedProfile.summary_short
  );
  assert(
    typeof generatedProfile.summary_full === 'string' && generatedProfile.summary_full.length > 20,
    'TEST 2.3: summary_full(종합 요약) 생성 확인'
  );
  assert(
    Array.isArray(generatedProfile.topics) && generatedProfile.topics.length >= 3,
    'TEST 2.4: topics(주요 주제 목록) 3개 이상 생성 확인'
  );
  assert(
    Array.isArray(generatedProfile.concepts) && generatedProfile.concepts.includes('일주기리듬(Circadian Rhythm)'),
    'TEST 2.5: concepts(지식 그래프 핵심 개념) 도메인 특화 추출 확인'
  );
  assert(
    Array.isArray(generatedProfile.target_population) && generatedProfile.target_population.length > 0,
    'TEST 2.6: target_population(대상 인구) 추출 확인'
  );
  assert(
    Array.isArray(generatedProfile.categories) && generatedProfile.categories[0].includes('일주기리듬 >'),
    'TEST 2.7: categories(추천 계층형 카테고리) 생성 확인'
  );
  assert(
    Array.isArray(generatedProfile.structure) && generatedProfile.structure.length > 0,
    'TEST 2.8: structure(문서 목차 구조) 생성 확인'
  );
  assert(
    Array.isArray(generatedProfile.candidate_entities) && generatedProfile.candidate_entities.length >= 3,
    'TEST 2.9: candidate_entities(후보 엔티티) 지식 그래프 노드 사전 추출 확인'
  );
  assert(
    Array.isArray(generatedProfile.cross_domain_connections) && generatedProfile.cross_domain_connections.length > 0,
    'TEST 2.10: cross_domain_connections(4대 분야 교차 연결 힌트) 도출 확인'
  );

  // 3. ProfileCache 결정론적 키 및 캐싱 검증
  console.log('\n--- 3. ProfileCache 캐싱 검증 ---');
  const cacheKey1 = ProfileCache.computeKey('DOC-TEST-001', 'document_profile', 'v1', 'gpt-4o');
  const cacheKey2 = ProfileCache.computeKey('DOC-TEST-001', 'document_profile', 'v1', 'gpt-4o');
  const cacheKey3 = ProfileCache.computeKey('DOC-TEST-002', 'document_profile', 'v1', 'gpt-4o');
  assert(cacheKey1 === cacheKey2, 'TEST 3.1: 동일 인자에 대한 캐시 키 결정론적(Deterministic) 일치');
  assert(cacheKey1 !== cacheKey3, 'TEST 3.2: 타 문서에 대한 캐시 키 분리 확인');

  await ProfileCache.set(cacheKey1, 'DOC-TEST-001', 'document_profile', 'v1', 'gpt-4o', generatedProfile);
  const cachedProfile = await ProfileCache.get(cacheKey1);
  assert(
    cachedProfile?.summary_short === generatedProfile.summary_short,
    'TEST 3.3: 캐시된 프로파일 정상 인출 확인'
  );

  // 4. DocumentProfiler 서비스 분석 및 사용자 편집/승인 검증
  console.log('\n--- 4. DocumentProfiler 서비스 검증 ---');
  const testDocId = 'test-doc-circadian-001';
  const analyzed = await DocumentProfiler.analyzeDocument(testDocId, { forceReanalyze: true });
  assert(
    analyzed.document_id === testDocId,
    'TEST 4.1: DocumentProfiler.analyzeDocument 실행 및 document_id 매핑'
  );
  assert(
    analyzed.status === 'PROPOSED',
    'TEST 4.2: 초기 분석 상태가 PROPOSED(제안됨)로 설정됨 (강제 확정 안 함 원칙 준수)'
  );

  // 사용자가 주제/개념 수동 수정 시뮬레이션
  const edited = await DocumentProfiler.updateProfile(testDocId, {
    summary_short: '사용자가 수정한 수면 및 빛 노출 핵심 지침',
    topics: [...analyzed.topics, '사용자 맞춤 주제'],
  }, false);
  assert(
    edited.status === 'EDITED' && edited.summary_short === '사용자가 수정한 수면 및 빛 노출 핵심 지침',
    'TEST 4.3: 사용자 수정 사항 반영 및 EDITED 상태 전이 확인'
  );

  // 사용자 최종 승인(Approve) 시뮬레이션
  const approved = await DocumentProfiler.updateProfile(testDocId, edited, true);
  assert(
    approved.status === 'APPROVED',
    'TEST 4.4: 사용자 최종 승인 시 status가 APPROVED로 전환됨'
  );

  console.log('\n===============================================================');
  console.log(`📊 [PHASE 1 결과] 총 ${passed + failed}개 테스트 중 ${passed}개 통과 / ${failed}개 실패`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase1Tests().catch((err) => {
  console.error('테스트 실행 중 치명적 오류:', err);
  process.exit(1);
});
