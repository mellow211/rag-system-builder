import { LLMProvider, LLMStructuredRequest, LLMTextRequest } from './types';
import { DocumentProfile } from '@/types/rag';

export class MockLLMProvider implements LLMProvider {
  readonly providerName = 'mock';
  readonly defaultModel = 'mock-llm-v1';

  async generateStructured<T>(req: LLMStructuredRequest): Promise<T> {
    const text = req.prompt;

    // DocumentProfile 요청인지 감지
    if (req.schemaName === 'DocumentProfile') {
      const profile = this.createMockDocumentProfile(text);
      return profile as unknown as T;
    }

    // KnowledgeGraphExtraction 요청인지 감지
    if (req.schemaName === 'KnowledgeGraphExtraction') {
      return this.createMockGraphExtraction(text) as unknown as T;
    }

    // CategoryExpansionSuggestion 요청인지 감지
    if (req.schemaName === 'CategoryExpansionSuggestion') {
      return {
        suggestions: [
          { name: '광치료', description: '고령자 일주기리듬 조절을 위한 인공광 및 자연광 요법', rationale: '수면 위생 및 일주기리듬 문서에서 빈출되는 중재 치료 기법' },
          { name: '수면 단편화', description: '야간 잦은 각성 상태 분석', rationale: '노년기 수면 질 저하의 핵심 병태생리' },
        ],
      } as unknown as T;
    }

    // 기본 빈 JSON 구조 (스키마 기준 기본값 조합)
    const fallback: Record<string, unknown> = {};
    if (req.schema.properties) {
      for (const [key, val] of Object.entries(req.schema.properties as Record<string, any>)) {
        if (val.type === 'array') fallback[key] = [];
        else if (val.type === 'string') fallback[key] = '';
        else if (val.type === 'number') fallback[key] = 0;
        else if (val.type === 'object') fallback[key] = {};
        else fallback[key] = null;
      }
    }
    return fallback as T;
  }

  async generateText(req: LLMTextRequest): Promise<string> {
    if (req.prompt.includes('요약')) {
      return '이 문서는 고령자 건강 관리 및 일상생활 중재 방안을 다룬 전문 학술 지침서입니다.';
    }
    return 'Mock LLM에 의해 생성된 응답입니다.';
  }

  private createMockDocumentProfile(prompt: string): DocumentProfile {
    // 텍스트 분석 기반 도메인 및 키워드 감지
    let domain: DocumentProfile['domain'] = 'health';
    if (prompt.includes('수면') || prompt.includes('생체시계') || prompt.includes('일주기') || prompt.includes('circadian') || prompt.includes('멜라토닌')) {
      domain = 'circadian';
    } else if (prompt.includes('양생') || prompt.includes('섭생') || prompt.includes('식이요법') || prompt.includes('계절')) {
      domain = 'yangsaeng';
    } else if (prompt.includes('한의') || prompt.includes('사상체질') || prompt.includes('변증') || prompt.includes('소음인') || prompt.includes('태음인')) {
      domain = 'korean-medicine';
    }

    // 제목 추출 시도
    let title = '고령자 건강정보 전문 지침';
    const titleMatch = prompt.match(/\[문서 제목\]:\s*(.+)/) || prompt.match(/제목:\s*(.+)/);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    // 도메인별 특화 프로파일 프리셋 생성
    if (domain === 'circadian') {
      return {
        document_id: '',
        domain: 'circadian',
        document_type: '가이드라인',
        summary_short: `${title}에 따른 노년기 일주기 생체리듬 안정화 및 수면 장애 개선 가이드라인`,
        summary_full: `본 문서는 고령자의 노화에 따른 생체시계(SCN) 퇴행과 멜라토닌 분비 감소로 인해 발생하는 야간 각성, 조기 기상, 주간 졸림증의 병태생리를 규명하고, 아침 자연광 노출 및 수면 위생 준수를 통한 비약물적 치료 및 관리 방안을 체계적으로 제시합니다.`,
        topics: ['고령자 수면 변화', '일주기리듬 장애', '빛 노출 요법', '노년기 멜라토닌 조절', '수면위생 권고사항'],
        concepts: ['일주기리듬(Circadian Rhythm)', '시교차상핵(SCN)', '멜라토닌(Melatonin)', '야간 각성', '수면 효율', '광치료'],
        keywords: ['생체시계', '조기기상', '수면위생', '아침 햇빛', '블루라이트 차단', '노인 불면'],
        target_population: ['65세 이상 고령자', '수면장애 호소 노인', '요양시설 입소자', '노인 돌봄 제공자'],
        diseases: ['노년기 불면증', '수면각성위상전진증후군(ASPS)', '수면무호흡증', '노인성 우울증'],
        health_metrics: ['수면 효율(%)', '총 수면 시간(TST)', '입면 후 각성 시간(WASO)', '입면 잠복기'],
        lifestyle_factors: ['아침 30분 산책/채광', '취침 전 스마트폰 사용 제한', '규칙적인 기상 시간 유지', '오후 카페인 제한'],
        categories: ['일주기리듬 > 수면 위생', '일주기리듬 > 환경 및 빛 노출', '일주기리듬 > 생체시계'],
        structure: [
          { title: '1. 서론: 노화와 일주기리듬의 변화', level: 1, subsections: ['1.1 생체시계 퇴행', '1.2 호르몬 분비 변화'] },
          { title: '2. 고령자 수면 장애의 특징', level: 1, subsections: ['2.1 야간 각성 빈도 증가', '2.2 조기 기상'] },
          { title: '3. 빛 노출과 멜라토닌 조절 기전', level: 1, subsections: ['3.1 아침 자연광 효과', '3.2 저녁 조명 관리'] },
          { title: '4. 고령자 맞춤형 생활관리 권고사항', level: 1, subsections: ['4.1 규칙적 일과', '4.2 신체활동 권고'] },
        ],
        candidate_entities: [
          { name: '고령자', type: 'demographic', description: '65세 이상의 노화 인구집단' },
          { name: '수면', type: 'concept', description: '신체 및 인지 회복을 위한 필수 생리적 상태' },
          { name: '일주기리듬', type: 'concept', description: '24시간 주기의 생체 내 리듬 조절 메커니즘' },
          { name: '빛 노출', type: 'factor', description: '망막을 통해 시교차상핵을 동기화하는 외생적 인자' },
          { name: '멜라토닌', type: 'metric', description: '송과체에서 분비되는 수면 유도 호르몬' },
        ],
        cross_domain_connections: [
          { domain: 'health', concept: '신체활동', rationale: '낮 시간의 적정 유산소 운동은 야간 수면 효율을 증진시킴' },
          { domain: 'yangsaeng', concept: '조와조기(早臥早起)', rationale: '일찍 자고 일찍 일어나는 전통 섭생법과 일주기 리듬의 상통' },
          { domain: 'korean-medicine', concept: '음양기혈(陰陽氣血)', rationale: '낮의 양기 활동과 밤의 음기 수렴 균형 관점과 일치' },
        ],
        llm_model: 'mock-intelligence-v1',
        prompt_version: 'document_profile_v1',
        profile_version: 'v1',
        status: 'PROPOSED',
      };
    } else if (domain === 'yangsaeng') {
      return {
        document_id: '',
        domain: 'yangsaeng',
        document_type: '가이드라인',
        summary_short: `${title}에 기반한 전통 양생 및 사시(四時) 섭생 건강관리 가이드`,
        summary_full: `본 문서는 자연의 변화와 사계절 기후 특성에 순응하여 질병을 예방하고 무병장수를 도모하는 전통 한의 양생법의 핵심 원리와 식생, 기거, 심신 수양 수칙을 포괄적으로 설명합니다.`,
        topics: ['사시(四時) 섭생법', '식사 양생', '기거(起居) 양생', '노년기 정신 수양', '경락 마사지'],
        concepts: ['천인상응(天人相應)', '미병(未病)', '사시음양(四時陰陽)', '비위보양(脾胃保養)'],
        keywords: ['양생', '섭생', '온열요법', '식이양생', '기혈순환'],
        target_population: ['노년기 건강증진 희망자', '만성 피로 호소 고령자', '전통 건강법 관심자'],
        diseases: ['허약노인 증후군', '소화불량', '수족냉증', '노년기 관절통'],
        health_metrics: ['소화 흡수율', '체온 유지 상태', '기혈 순환 지수'],
        lifestyle_factors: ['계절별 제철 식재료 섭취', '따뜻한 온수 섭취', '과식 자제 및 소식', '아침 맨손 기체조'],
        categories: ['양생 > 사시 섭생', '양생 > 식이 양생', '양생 > 기거 양생'],
        structure: [
          { title: '1. 전통 양생의 대원칙', level: 1 },
          { title: '2. 사계절 건강관리 요결', level: 1 },
          { title: '3. 고령자 식이 및 기거 권고', level: 1 },
        ],
        candidate_entities: [
          { name: '고령자', type: 'demographic' },
          { name: '양생법', type: 'concept' },
          { name: '비위 기능', type: 'metric' },
          { name: '온열 섭생', type: 'factor' },
        ],
        cross_domain_connections: [
          { domain: 'circadian', concept: '수면', rationale: '계절별 일출일몰에 따른 취침/기상 조절과 일맥상통' },
          { domain: 'korean-medicine', concept: '사상체질', rationale: '개인 체질별 맞춤형 양생 식재료 선택 필요' },
        ],
        llm_model: 'mock-intelligence-v1',
        prompt_version: 'document_profile_v1',
        profile_version: 'v1',
        status: 'PROPOSED',
      };
    } else if (domain === 'korean-medicine') {
      return {
        document_id: '',
        domain: 'korean-medicine',
        document_type: '논문',
        summary_short: `${title}에 따른 한의학적 사상체질 감별 및 임상 문진 진단 지표`,
        summary_full: `본 문서는 사상체질의학의 생리·병리적 특성에 기반하여 고령 환자의 체질별 취약 질환을 진단하고, 망문문절(望聞問切) 문진 척도를 표준화하여 맞춤형 예방 및 치료 지침을 제시합니다.`,
        topics: ['사상체질 분류', '기혈 음양 변증', '한의 문진 평가 지표', '체질별 다빈도 질환'],
        concepts: ['사상체질(四象體質)', '태음인/소음인/소양인/태양인', '변증(辨證)', '장부허실(臟腑虛實)'],
        keywords: ['체질문진', '맥진', '설진', '한의평가', '체질식이'],
        target_population: ['한의 임상 대상 고령자', '만성 질환자', '체질 진단 희망 노인'],
        diseases: ['중풍 전조증', '비위허약', '신양허', '기허증'],
        health_metrics: ['사상체질 문진 점수', '기혈 순환 지표', '소화/대소변 양상'],
        lifestyle_factors: ['체질 맞춤 음식 섭취', '정서적 평정 유지', '격렬한 감정 기복 자제'],
        categories: ['한의문진 > 사상체질', '한의문진 > 변증 진단', '한의문진 > 임상 문진표'],
        structure: [
          { title: '1. 사상체질의학의 이론적 배경', level: 1 },
          { title: '2. 노인 환자의 문진 평가 항목', level: 1 },
          { title: '3. 체질별 관리 지침', level: 1 },
        ],
        candidate_entities: [
          { name: '고령자', type: 'demographic' },
          { name: '사상체질', type: 'concept' },
          { name: '소음인', type: 'concept' },
          { name: '태음인', type: 'concept' },
        ],
        cross_domain_connections: [
          { domain: 'health', concept: '만성질환', rationale: '태음인의 심혈관 및 대사증후군 관리와 직결' },
          { domain: 'circadian', concept: '수면 패턴', rationale: '체질별 수면 특성 및 불면 성향 분석 연계' },
        ],
        llm_model: 'mock-intelligence-v1',
        prompt_version: 'document_profile_v1',
        profile_version: 'v1',
        status: 'PROPOSED',
      };
    }

    // Default: health
    return {
      document_id: '',
      domain: 'health',
      document_type: '가이드라인',
      summary_short: `${title}에 관한 고령자 만성질환 예방 및 운동·영양 가이드`,
      summary_full: `본 문서는 고령층에서 호발하는 주요 만성질환(고혈압, 당뇨병, 근감소증 등)의 예방과 관리를 위하여, 의학적 근거에 기반한 적정 영양 섭취 기준과 안전한 근력·유산소 운동 프로그램을 종합적으로 제시합니다.`,
      topics: ['노년기 만성질환 관리', '근감소증 예방', '영양 섭취 지침', '안전한 실내외 운동 수칙'],
      concepts: ['근감소증(Sarcopenia)', '혈당 조절', '수축기 혈압', '단백질 섭취', '유산소 운동'],
      keywords: ['고령자 건강', '만성질환', '낙상 예방', '단백질 권장량', '유연성 운동'],
      target_population: ['65세 이상 지역사회 거주 노인', '만성질환 보유 고령자', '보건소 운동 프로그램 참여자'],
      diseases: ['고혈압', '제2형 당뇨병', '골다공증', '퇴행성 관절염'],
      health_metrics: ['혈압(mmHg)', '공복혈당(mg/dL)', '골밀도(T-score)', '보행 속도'],
      lifestyle_factors: ['매일 30분 걷기', '체중당 1.2g 단백질 섭취', '저염식 식이', '수분 충분 섭취'],
      categories: ['건강정보 > 만성질환 관리', '건강정보 > 영양 가이드', '건강정보 > 운동 수칙'],
      structure: [
        { title: '1. 고령자 만성질환 현황 및 중요성', level: 1 },
        { title: '2. 영양 관리 및 균형 식단', level: 1 },
        { title: '3. 단계별 신체활동 및 운동 처방', level: 1 },
        { title: '4. 일상생활 낙상 및 안전 수칙', level: 1 },
      ],
      candidate_entities: [
        { name: '고령자', type: 'demographic' },
        { name: '만성질환', type: 'disease' },
        { name: '신체활동', type: 'factor' },
        { name: '단백질 섭취', type: 'metric' },
      ],
      cross_domain_connections: [
        { domain: 'circadian', concept: '일주기리듬', rationale: '규칙적 운동은 일주기 생체리듬과 수면 개선에 기여' },
        { domain: 'yangsaeng', concept: '식이 섭생', rationale: '전통 제철 식이 및 온식 양생법과 현대 영양학의 조화' },
      ],
      llm_model: 'mock-intelligence-v1',
      prompt_version: 'document_profile_v1',
      profile_version: 'v1',
      status: 'PROPOSED',
    };
  }

  private createMockGraphExtraction(prompt: string) {
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
          evidence_text: '아침 시간대의 자연광 및 햇빛 노출은 뇌의 시교차상핵(SCN)을 자극하여 일주기리듬을 24시간 주기로 동기화한다.',
          confidence: 0.95,
        },
        {
          source_name: '일주기리듬',
          target_name: '수면',
          relation_type: 'affects',
          evidence_text: '일주기리듬이 정상적으로 동기화되면 야간의 멜라토닌 분비가 촉진되고 깊은 수면 단계가 연장된다.',
          confidence: 0.92,
        },
        {
          source_name: '신체활동',
          target_name: '수면',
          relation_type: 'associated_with',
          evidence_text: '낮 시간대의 30분 유산소 신체활동은 야간 중심체온 하강을 도와 수면의 질을 개선한다.',
          confidence: 0.89,
        },
      ],
    };
  }
}
