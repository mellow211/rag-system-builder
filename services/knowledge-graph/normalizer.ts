export interface CanonicalMapping {
  canonicalName: string;
  aliases: string[];
}

export class EntityNormalizer {
  // 기본 기구축 고령자 건강 도메인 정규화 사전 (별칭/표현 -> 표준 정규화 명칭)
  private static dictionary: Map<string, string> = new Map([
    // 인구
    ['노인', '고령자'],
    ['어르신', '고령자'],
    ['elderly', '고령자'],
    ['older adults', '고령자'],
    ['senior', '고령자'],

    // 일주기/수면
    ['생체리듬', '일주기리듬'],
    ['서카디안', '일주기리듬'],
    ['circadian rhythm', '일주기리듬'],
    ['수면 상태', '수면'],
    ['수면상태', '수면'],
    ['잠', '수면'],
    ['sleep', '수면'],
    ['수면효과', '수면 효율'],
    ['수면 효율성', '수면 효율'],
    ['sleep efficiency', '수면 효율'],
    ['햇빛', '빛 노출'],
    ['자연광', '빛 노출'],
    ['일광', '빛 노출'],
    ['sunlight', '빛 노출'],
    ['light exposure', '빛 노출'],
    ['멜라토닌 수치', '멜라토닌'],

    // 건강/의학
    ['혈압', '수축기 혈압'],
    ['혈압 수치', '수축기 혈압'],
    ['blood pressure', '수축기 혈압'],
    ['공복혈당치', '공복혈당'],
    ['혈당', '공복혈당'],
    ['운동', '신체활동'],
    ['physical activity', '신체활동'],
    ['보행', '신체활동'],
    ['근력저하', '근감소증'],
    ['sarcopenia', '근감소증'],

    // 양생/한의
    ['기거양생', '조와조기'],
    ['조와조기 섭생', '조와조기'],
    ['양생법', '양생'],
    ['섭생법', '섭생'],
    ['사상체질의학', '사상체질'],
    ['체질의학', '사상체질'],
  ]);

  /**
   * 입력된 개념명의 대표 표준형(Canonical Name)과 별칭 목록을 반환합니다.
   */
  public static normalize(name: string, domain?: string): CanonicalMapping {
    const canonicalName = this.getCanonicalName(name);
    const aliases = this.getAliases(canonicalName);
    return { canonicalName, aliases };
  }

  /**
   * 입력된 단어의 표준 정규화 명칭을 반환합니다.
   */
  public static getCanonicalName(name: string): string {
    const clean = name.trim();
    const lower = clean.toLowerCase();
    if (this.dictionary.has(lower)) {
      return this.dictionary.get(lower)!;
    }
    if (this.dictionary.has(clean)) {
      return this.dictionary.get(clean)!;
    }
    return clean;
  }

  /**
   * 표준어에 매핑된 알려진 별칭(Aliases) 목록을 반환합니다.
   */
  public static getAliases(canonicalName: string): string[] {
    const aliases: string[] = [];
    for (const [alias, canonical] of this.dictionary.entries()) {
      if (canonical === canonicalName && alias !== canonicalName) {
        aliases.push(alias);
      }
    }
    return aliases;
  }

  /**
   * 신규 별칭을 사전에 동적 등록합니다.
   */
  public static registerAlias(alias: string, canonical: string): void {
    this.dictionary.set(alias.trim().toLowerCase(), canonical.trim());
  }
}
