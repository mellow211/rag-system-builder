import Replicate from 'replicate';
import { LLMProvider, LLMStructuredRequest, LLMTextRequest } from './types';

export class ReplicateLLMProvider implements LLMProvider {
  readonly providerName = 'replicate';
  readonly defaultModel: string;
  private replicate: Replicate;

  constructor(apiToken?: string, defaultModel?: string) {
    const token = apiToken || process.env.REPLICATE_API_TOKEN;
    if (!token) {
      throw new Error(
        'REPLICATE_API_TOKEN 환경변수가 설정되지 않았습니다. .env.local 또는 Vercel 환경변수에서 설정해 주세요.'
      );
    }

    this.replicate = new Replicate({ auth: token });
    // 빠른 응답과 높은 안정성을 위해 meta/meta-llama-3-8b-instruct 기본 사용 (환경변수로 70b 등으로 승격 가능)
    this.defaultModel =
      defaultModel || process.env.REPLICATE_LLM_MODEL || 'meta/meta-llama-3-8b-instruct';
  }

  async generateStructured<T>(req: LLMStructuredRequest): Promise<T> {
    const model = (req.model || this.defaultModel) as `${string}/${string}`;

    const systemInstruction = `You are a high-precision medical & clinical knowledge engine.
CRITICAL REQUIREMENT: You MUST respond ONLY with a single, valid, parseable JSON object matching the requested schema.
DO NOT include any explanation, conversational text, markdown preamble, or notes outside the JSON.
All Korean terms and medical concepts must be accurately preserved in natural Korean.`;

    const fullPrompt = `${req.prompt}

[REQUIRED JSON SCHEMA]:
${JSON.stringify(req.schema, null, 2)}

[INSTRUCTION]:
Return ONLY the raw JSON object conforming strictly to the schema above. Begin directly with "{" and end with "}".`;

    const maxTokens = req.maxTokens || 2500;
    const temperature = req.temperature ?? 0.1;

    try {
      const output: any = await this.replicate.run(model, {
        input: {
          system_prompt: req.systemPrompt
            ? `${systemInstruction}\n\n${req.systemPrompt}`
            : systemInstruction,
          prompt: fullPrompt,
          temperature,
          max_tokens: maxTokens,
        },
      });

      const raw = Array.isArray(output) ? output.join('') : String(output);
      return this.parseJsonOutput<T>(raw, req.schemaName);
    } catch (err: any) {
      console.error(`[ReplicateLLMProvider] 구조화 생성 실패 (${model}):`, err.message || err);
      throw err;
    }
  }

  async generateText(req: LLMTextRequest): Promise<string> {
    const model = (req.model || this.defaultModel) as `${string}/${string}`;

    try {
      const output: any = await this.replicate.run(model, {
        input: {
          system_prompt: req.systemPrompt || '당신은 시니어 고령자 건강 지식 시스템의 AI 전문가입니다.',
          prompt: req.prompt,
          temperature: req.temperature ?? 0.3,
          max_tokens: req.maxTokens ?? 2000,
        },
      });

      return (Array.isArray(output) ? output.join('') : String(output)).trim();
    } catch (err: any) {
      console.error(`[ReplicateLLMProvider] 텍스트 생성 실패 (${model}):`, err.message || err);
      throw err;
    }
  }

  /**
   * 모델 출력에서 JSON 객체를 안전하게 파싱합니다.
   */
  private parseJsonOutput<T>(raw: string, schemaName?: string): T {
    let clean = raw.trim();

    // 1. ```json ... ``` 코드 블록 추출
    const codeBlockMatch = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      clean = codeBlockMatch[1].trim();
    }

    // 2. 만약 앞뒤에 잡음 텍스트가 있을 경우 첫 '{' 와 마지막 '}' 사이 추출
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      clean = clean.substring(firstBrace, lastBrace + 1);
    }

    try {
      return JSON.parse(clean) as T;
    } catch (err) {
      console.warn(`[ReplicateLLMProvider] 1차 JSON 파싱 실패 (${schemaName}), 정제 후 재시도... 원본 앞부분:`, raw.slice(0, 150));
      // 후행 콤마 제거 등 경미한 오류 교정
      const relaxed = clean
        .replace(/,\s*([\]}])/g, '$1') // trailing commas
        .replace(/[\u0000-\u001F]+/g, ' '); // control chars

      return JSON.parse(relaxed) as T;
    }
  }
}
