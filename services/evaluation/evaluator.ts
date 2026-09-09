import { advancedSearchService, SearchPipelineMode } from '../retrieval/advanced-search';
import { DomainType } from '@/types/rag';
import { calculateEvaluationMetrics, EvaluationMetrics, QuestionEvalResult } from './metrics';

export interface EvalQuestionItem {
  id: string;
  domain: DomainType;
  question: string;
  expectedKeywords: string[];
  expectedDocTitleKeyword?: string;
  notes?: string;
}

// 4대 도메인 표준 RAG 평가 벤치마크 데이터셋 (총 12문항)
export const BENCHMARK_EVAL_DATASET: EvalQuestionItem[] = [
  // 1. 일주기리듬 (circadian)
  {
    id: 'circ-1',
    domain: 'circadian',
    question: '고령자가 밤에 자꾸 깨는 원인은?',
    expectedKeywords: ['수면', '각성', '생체시계', '노년'],
    expectedDocTitleKeyword: '수면',
    notes: '구어체 야간 각성 증상과 수면 유지 장애 매칭',
  },
  {
    id: 'circ-2',
    domain: 'circadian',
    question: '아침 햇빛 노출과 멜라토닌 분비의 관계',
    expectedKeywords: ['자연광', '멜라토닌', '생체시계', '노출'],
    expectedDocTitleKeyword: '수면',
    notes: '아침 햇볕 노출과 멜라토닌 동기화 권고안',
  },
  {
    id: 'circ-3',
    domain: 'circadian',
    question: '낮잠 시간이 야간 수면 질에 미치는 영향',
    expectedKeywords: ['낮잠', '수면', '야간', '수면위생'],
    expectedDocTitleKeyword: '수면',
    notes: '낮잠 30분 이내 제한 가이드라인',
  },

  // 2. 양생 (yangsaeng)
  {
    id: 'yang-1',
    domain: 'yangsaeng',
    question: '동의보감에서 강조하는 노인 양생과 식이 원칙',
    expectedKeywords: ['東醫寶鑑', '동의보감', '양생', '식이'],
    expectedDocTitleKeyword: '양생',
    notes: '동의보감 내경편 및 양생의학적 식이 요법',
  },
  {
    id: 'yang-2',
    domain: 'yangsaeng',
    question: '환절기 노인 체온 관리와 섭생법',
    expectedKeywords: ['체온', '섭생', '양생'],
    expectedDocTitleKeyword: '양생',
    notes: '계절별 한기 회피 및 보온 수칙',
  },
  {
    id: 'yang-3',
    domain: 'yangsaeng',
    question: '조와조기(早臥早起)의 건강 효능',
    expectedKeywords: ['양생', '수면', '조기'],
    expectedDocTitleKeyword: '양생',
    notes: '일찍 자고 일찍 일어나는 양생 수칙',
  },

  // 3. 건강정보 (health)
  {
    id: 'hlth-1',
    domain: 'health',
    question: '만 65세 이상 노인의 하루 단백질 권장 섭취량',
    expectedKeywords: ['단백질', '섭취량', '고령자', '영양'],
    expectedDocTitleKeyword: '가이드라인',
    notes: '노년기 근감소증 예방을 위한 단백질 가이드',
  },
  {
    id: 'hlth-2',
    domain: 'health',
    question: '퇴행성 관절염 고령자를 위한 안전한 유산소 운동',
    expectedKeywords: ['관절염', '운동', '유산소', '고령자'],
    expectedDocTitleKeyword: '가이드라인',
    notes: '수중 운동 및 평지 보행 지침',
  },
  {
    id: 'hlth-3',
    domain: 'health',
    question: '고령자의 적절한 일일 수면시간 권고',
    expectedKeywords: ['수면', '시간', '고령자'],
    expectedDocTitleKeyword: '가이드라인',
    notes: '7~8시간 표준 권고안',
  },

  // 4. 한의문진 (korean-medicine)
  {
    id: 'km-1',
    domain: 'korean-medicine',
    question: '사상체질 소음인의 소화기능 저하 시 대처법',
    expectedKeywords: ['소음인', '체질', '소화', '비위'],
    expectedDocTitleKeyword: '체질',
    notes: '소음인 온열성 음식 섭취와 소화 관리',
  },
  {
    id: 'km-2',
    domain: 'korean-medicine',
    question: '고령자 기혈허약(氣血虛弱) 변증과 문진 지표',
    expectedKeywords: ['기혈', '허약', '변증', '문진'],
    expectedDocTitleKeyword: '문진',
    notes: '기허, 혈허 평가 문진 항목',
  },
  {
    id: 'km-3',
    domain: 'korean-medicine',
    question: '노인 어지럼증(眩暈)의 한의학적 진단 질문',
    expectedKeywords: ['어지럼', '현훈', '문진'],
    expectedDocTitleKeyword: '문진',
    notes: '담음, 간양상항 감별 문진',
  },
];

export interface RunEvaluationParams {
  domain?: DomainType;
  mode: SearchPipelineMode;
  topK?: number;
}

export interface RunEvaluationResult {
  mode: SearchPipelineMode;
  domain?: DomainType;
  metrics: EvaluationMetrics;
  questionResults: QuestionEvalResult[];
  executedAt: string;
}

export class RagEvaluator {
  /**
   * 지정된 검색 모드(Vector, Hybrid, Advanced v2)로 벤치마크 평가를 일괄 실행합니다.
   */
  async runEvaluation(params: RunEvaluationParams): Promise<RunEvaluationResult> {
    const { domain, mode, topK = 5 } = params;

    // 평가 대상 질문 필터링
    const questions = domain
      ? BENCHMARK_EVAL_DATASET.filter((q) => q.domain === domain)
      : BENCHMARK_EVAL_DATASET;

    const questionResults: QuestionEvalResult[] = [];

    for (const q of questions) {
      const startTime = Date.now();

      try {
        const searchRes = await advancedSearchService.search({
          domain: q.domain,
          query: q.question,
          mode,
          topK,
        });

        const latencyMs = Date.now() - startTime;
        const retrieved = searchRes.results || [];

        // 정답 매칭 판별 (기대 키워드 또는 기대 문서명이 청크에 포함되었는지 검증)
        let matchedRank: number | null = null;

        for (let i = 0; i < retrieved.length; i++) {
          const item = retrieved[i];
          const content = item.content || '';
          const title = item.document_title || '';

          // 1. 기대 키워드 매칭율 검사 (키워드의 50% 이상 매칭 시 True)
          const keywordHits = q.expectedKeywords.filter((k) =>
            content.includes(k) || title.includes(k)
          ).length;
          const isKeywordMatch = keywordHits >= Math.ceil(q.expectedKeywords.length * 0.5);

          // 2. 문서명 매칭 검사
          const isDocMatch = q.expectedDocTitleKeyword
            ? title.includes(q.expectedDocTitleKeyword)
            : false;

          if (isKeywordMatch || isDocMatch) {
            matchedRank = i + 1;
            break;
          }
        }

        const hitAt1 = matchedRank === 1;
        const hitAt3 = matchedRank !== null && matchedRank <= 3;
        const hitAt5 = matchedRank !== null && matchedRank <= 5;
        const reciprocalRank = matchedRank !== null ? parseFloat((1 / matchedRank).toFixed(4)) : 0.0;

        questionResults.push({
          questionId: q.id,
          question: q.question,
          expectedKeywords: q.expectedKeywords,
          retrievedChunkIds: retrieved.map((r) => r.id),
          retrievedDocIds: Array.from(new Set(retrieved.map((r) => r.document_id))),
          matchedRank,
          hitAt1,
          hitAt3,
          hitAt5,
          reciprocalRank,
          latencyMs,
          topResultTitle: retrieved[0]?.document_title,
          topResultContent: retrieved[0]?.content?.slice(0, 100),
        });
      } catch (err) {
        console.error(`Error evaluating question ${q.id}:`, err);
        questionResults.push({
          questionId: q.id,
          question: q.question,
          expectedKeywords: q.expectedKeywords,
          retrievedChunkIds: [],
          retrievedDocIds: [],
          matchedRank: null,
          hitAt1: false,
          hitAt3: false,
          hitAt5: false,
          reciprocalRank: 0,
          latencyMs: Date.now() - startTime,
        });
      }
    }

    const metrics = calculateEvaluationMetrics(questionResults);

    return {
      mode,
      domain,
      metrics,
      questionResults,
      executedAt: new Date().toISOString(),
    };
  }
}

export const ragEvaluator = new RagEvaluator();
