import { InitialChunkDesigner } from '../services/chunking-agent/initial-designer';

async function runMultiDocumentTypesTest() {
  console.log('========================================================================');
  console.log('📚 [TEST] Multi-Document Types Chunking Adaptation Suite');
  console.log('    (임상 가이드라인 · 전통 양생/한의문진 · 학술 논문 3대 유형 자동 적응)');
  console.log('========================================================================\n');

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

  // ========================================================================
  // [문서 유형 1] 고령자 만성질환 임상 가이드라인 (Clinical Health Guideline)
  // ========================================================================
  console.log('--- 1. [임상/건강 가이드라인] 자동 식별 및 맞춤 청킹 검증 ---');
  const clinicalDocId = 'doc-clinical-guideline-001';
  const clinicalDoc = {
    id: clinicalDocId,
    title: '고령자 고혈압 및 당뇨병 관리 임상 가이드라인',
    metadata: {
      domain: 'health',
      document_type: '가이드라인',
    },
  };

  const clinicalPages = [
    {
      pageNumber: 1,
      text: `1. 개요 및 질환 현황
본 임상 가이드라인은 고령층에서 흔히 동반되는 고혈압과 제2형 당뇨병의 역학적 특징과 다빈도 합병증을 체계적으로 예방하기 위해 제정되었습니다.

2. 진단 기준 및 임상 평가
고령자의 고혈압 진단 기준은 수축기 혈압 140mmHg 이상 또는 이완기 혈압 90mmHg 이상으로 설정하며, 공복 혈당 126mg/dL 이상 시 당뇨병으로 정밀 평가합니다.

3. 약물 치료 및 중재 프로토콜
기저 질환과 신기능 저하를 고려하여 저용량 단일제부터 시작하며, 혈압 급강하로 인한 기립성 저혈압과 낙상 위험을 상시 모니터링합니다.

4. 균형 영양 및 식이 지침
일일 나트륨 섭취량을 2,000mg 이하로 제한하는 저염식을 원칙으로 하며, 근감소증 예방을 위해 체중 1kg당 1.2g 이상의 양질 단백질을 공급합니다.

5. 단계별 운동 처방 및 수칙
주당 150분 이상의 중강도 유산소 보행 운동과 함께, 대퇴사두근 강화를 위한 하지 근력 운동을 주 2~3회 규칙적으로 병행합니다.

6. 일상생활 관리 및 주의사항
가정 내 화장실과 침실에 야간 안전 손잡이를 설치하고, 어지럼증이나 식은땀 등 저혈당 전조 증상 발생 시 즉각 당분을 섭취하도록 교육합니다.`,
    },
  ];

  const clinicalResult = await InitialChunkDesigner.design(clinicalDocId, clinicalDoc, clinicalPages);
  const clinicalCategories = Array.from(new Set(clinicalResult.proposals.map((p) => p.category)));
  console.log('   [임상 가이드라인] 식별된 청크 카테고리:', clinicalCategories);

  assert(
    clinicalCategories.some((c) => c === '진단평가' || c === '개요'),
    'TEST 1.1: 임상 가이드라인에서 진단평가/개요 카테고리 자동 도출'
  );
  assert(
    clinicalCategories.some((c) => c === '영양식이' || c === '운동재활' || c === '치료프로토콜'),
    'TEST 1.2: 식이, 운동, 치료 프로토콜 전용 카테고리 정상 분류 (논문 서론으로 쏠리지 않음)'
  );
  assert(
    clinicalResult.proposals.length >= 4,
    `TEST 1.3: 가이드라인 6개 섹션 기반 세부 청크 제안 생성 (${clinicalResult.proposals.length}개)`
  );

  // ========================================================================
  // [문서 유형 2] 전통 사시 양생 및 한의문진 지침 (Yangsaeng & Korean Medicine)
  // ========================================================================
  console.log('\n--- 2. [전통 양생 & 한의문진] 자동 식별 및 맞춤 청킹 검증 ---');
  const yangsaengDocId = 'doc-yangsaeng-guide-002';
  const yangsaengDoc = {
    id: yangsaengDocId,
    title: '동의보감 기반 노년기 사시 기거양생 및 체질별 문진 수칙',
    metadata: {
      domain: 'yangsaeng',
      document_type: '양생서',
    },
  };

  const yangsaengPages = [
    {
      pageNumber: 1,
      text: `1. 개요 및 양생 기본원리
양생(養生)이란 자연의 사계절 섭리와 인체의 음양 조화를 맞추어 질병을 미연에 방지하고 천수를 온전히 누리는 전통 섭생의학입니다.

2. 체질 감별 및 한의문진
사상체질 의학에 근거하여 소음인은 소화기 허냉, 태음인은 기혈 순환 정체를 정밀 문진표를 통해 사전에 감별하고 변증합니다.

3. 사시 기거양생 수칙
봄과 여름에는 일찍 일어나 활동성을 높이고(조와조기), 가을과 겨울에는 일찍 잠자리에 들고 해가 뜬 후 기상하여 양기를 갈무리합니다.

4. 식이 양생 및 약선 지침
생랭(生冷)한 음식과 기름진 식사를 피하고, 비위를 따뜻하게 보하는 생강차와 대추차 등 온식(溫食)을 섭취합니다.

5. 도인 기공 및 경혈지압
아침 기상 직후 족삼리(足三里)와 용천혈(湧泉穴)을 부드럽게 지압하고, 가벼운 단전호흡과 기공 체조로 척추 관절을 이완합니다.

6. 양생 주의사항 및 금기
과도한 분노와 과식, 밤늦은 시간의 한기 노출은 심기(心氣)를 손상시키므로 노년기 양생의 절대 금기 사항입니다.`,
    },
  ];

  const yangsaengResult = await InitialChunkDesigner.design(yangsaengDocId, yangsaengDoc, yangsaengPages);
  const yangsaengCategories = Array.from(new Set(yangsaengResult.proposals.map((p) => p.category)));
  console.log('   [전통 양생 지침] 식별된 청크 카테고리:', yangsaengCategories);

  assert(
    yangsaengCategories.some((c) => c === '한의문진' || c === '기거양생'),
    'TEST 2.1: 전통 양생서에서 한의문진 및 기거양생 카테고리 자동 도출'
  );
  assert(
    yangsaengCategories.some((c) => c === '식이양생' || c === '경혈지압'),
    'TEST 2.2: 식이양생 및 경혈지압 전용 한의 카테고리 정확 분산'
  );
  assert(
    yangsaengResult.proposals.length >= 4,
    `TEST 2.3: 양생서 6개 섹션 기반 세부 청크 제안 생성 (${yangsaengResult.proposals.length}개)`
  );

  // ========================================================================
  // [문서 유형 3] 학술 연구 논문 (Academic Paper)
  // ========================================================================
  console.log('\n--- 3. [학술 연구 논문] IMRaD 정밀 청킹 검증 ---');
  const paperDocId = 'doc-academic-paper-003';
  const paperDoc = {
    id: paperDocId,
    title: '고령자의 일주기 생체리듬 교란과 수면 위생 개선 연구',
    metadata: {
      domain: 'circadian',
      document_type: '학술논문',
    },
  };

  const paperPages = [
    {
      pageNumber: 1,
      text: `[초록]
본 연구는 65세 이상 고령자 60명을 대상으로 광치료 중재가 24시간 일주기 생체리듬과 수면 효율에 미치는 임상적 효과를 규명하였다.

[서론: 노화와 생체시계 감쇠]
시교차상핵의 퇴행과 멜라토닌 분비 저하는 노년기 수면 단편화의 핵심 원인이다.

[연구 방법: 피험자 및 프로토콜]
4주간 매일 오전 5,000 Lux 고조도 광치료를 45분간 적용하고 액티그래피로 수면 지표를 측정하였다.

[연구 결과: 수면 효율 분석]
실험군의 수면 효율은 기저치 대비 13.5% 유의하게 향상되었다(p < 0.001).

[고찰: 광생물학적 기전]
아침 자연광 노출은 망막 신경절 세포를 통해 중추 시계를 강력히 동기화함을 확인하였다.

[결론 및 제언]
본 비약물적 복합 프로토콜은 고령자 수면장애의 안전한 치료 대안으로 권고된다.`,
    },
  ];

  const paperResult = await InitialChunkDesigner.design(paperDocId, paperDoc, paperPages);
  const paperCategories = Array.from(new Set(paperResult.proposals.map((p) => p.category)));
  console.log('   [학술 논문] 식별된 청크 카테고리:', paperCategories);

  assert(
    paperCategories.includes('초록') && paperCategories.includes('서론'),
    'TEST 3.1: 학술 논문에서 초록/서론 카테고리 정확 식별'
  );
  assert(
    paperCategories.includes('연구방법') && paperCategories.includes('연구결과'),
    'TEST 3.2: 학술 논문에서 연구방법/연구결과 카테고리 정확 식별'
  );
  assert(
    paperCategories.includes('고찰') && paperCategories.includes('결론'),
    'TEST 3.3: 학술 논문에서 고찰/결론 카테고리 정확 식별'
  );

  console.log('\n========================================================================');
  console.log(`📊 [다종 문서 적응 테스트 결과] 총 ${passed + failed}개 중 ${passed}개 통과 / ${failed}개 실패`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runMultiDocumentTypesTest().catch((err) => {
  console.error('Fatal Error in runMultiDocumentTypesTest:', err);
  process.exit(1);
});
