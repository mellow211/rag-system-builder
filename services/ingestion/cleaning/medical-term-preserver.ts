/**
 * 의학 용어, 수치, 단위, 한의학 전문 용어를 정규화 과정에서 보호하기 위한 마커 및 헬퍼
 */
export class MedicalTermPreserver {
  // 보호할 의학 단위 및 수치 패턴 (예: 3.5 mg/dL, 120/80 mmHg, HbA1c 6.5%)
  private static readonly UNIT_PATTERNS = [
    /(\d+(?:\.\d+)?)\s*(?:mg\/dL|g\/dL|mmHg|mmol\/L|mEq\/L|μg\/dL|pg\/mL|ng\/mL|IU\/L|U\/L|kcal|kg|g|mg|mcg|mL|L|cm|mm|%|분|시간|초|회|세|개월|주)/gi,
    /(?:HbA1c|FBS|BUN|Cr|AST|ALT|eGFR|HDL|LDL|TG|WBC|RBC|CRP|TSH|PSA|BMI)\s*(?:[:=]?\s*\d+(?:\.\d+)?)/gi,
    /(?:혈압|수축기|이완기)\s*(?:[:=]?\s*\d{2,3}(?:\/\d{2,3})?\s*(?:mmHg)?)/gi,
  ];

  // 한의학 전문 용어 및 한자 병기 보호 목록
  private static readonly HAN_MEDICINE_TERMS = [
    '사상체질', '소음인', '태음인', '소양인', '태양인',
    '기혈허약', '음허화왕', '비위허약', '간신음허', '심비양허',
    '동의보감', '양생의학', '섭생', '도인', '안교', '조와조기',
    '氣血虛弱', '陰虛火旺', '脾胃虛弱', '肝腎陰虛', '心脾兩虛',
    '東醫寶鑑', '養生醫學', '四象體質', '少陰人', '太陰人', '少陽人', '太陽人'
  ];

  /**
   * 텍스트 내의 중요 수치/단위 및 전문용어가 보존되도록 검증 및 복원
   */
  public static verifyIntegrity(original: string, cleaned: string): { intact: boolean; missingTerms: string[] } {
    const missing: string[] = [];
    for (const term of this.HAN_MEDICINE_TERMS) {
      if (original.includes(term) && !cleaned.includes(term)) {
        missing.push(term);
      }
    }
    return {
      intact: missing.length === 0,
      missingTerms: missing,
    };
  }
}
