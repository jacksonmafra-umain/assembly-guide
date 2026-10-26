import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';

export const MODEL = 'claude-opus-5-5';

export type StructuredCall = <T>(args: {
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  pdfs: Uint8Array[];
}) => Promise<T>;

/**
 * One structured request: PDFs as base64 document blocks, the response constrained to
 * `schema` through structured outputs. Retries once with the validation error appended.
 */
export function createClaudeCall(client: Anthropic = new Anthropic()): StructuredCall {
  return async ({ schema, system, prompt, pdfs }) => {
    let lastError = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      const content: Anthropic.ContentBlockParam[] = [
        ...pdfs.map((bytes): Anthropic.ContentBlockParam => ({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: Buffer.from(bytes).toString('base64') },
        })),
        { type: 'text', text: lastError ? `${prompt}\n\nYour previous answer was invalid: ${lastError}` : prompt },
      ];
      const response = await client.messages.parse({
        model: MODEL,
        max_tokens: 16000,
        system,
        output_config: { effort: 'high', format: zodOutputFormat(schema) },
        messages: [{ role: 'user', content }],
      });
      if (response.stop_reason === 'refusal') throw new Error(`Claude declined: ${response.stop_details?.explanation ?? 'no detail'}`);
      if (response.stop_reason === 'max_tokens') throw new Error('Claude hit max_tokens before finishing the JSON');
      const parsed = schema.safeParse(response.parsed_output);
      if (parsed.success) return parsed.data;
      lastError = parsed.error.message;
    }
    throw new Error(`Structured output failed validation twice: ${lastError}`);
  };
}
