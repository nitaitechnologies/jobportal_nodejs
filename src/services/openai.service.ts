import { env } from '../config/env';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';

export type OpenAiChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type OpenAiChatCompletionResponse = {
  choices?: Array<{
    message?: { content?: string | null };
  }>;
  model?: string;
  error?: { message?: string };
};

/**
 * Thin OpenAI Chat Completions client (no SDK).
 * Used for AI resume, job matching insights, and career coach.
 */
export class OpenAiService {
  isConfigured(): boolean {
    return Boolean(env.openaiApiKey);
  }

  getModel(): string {
    return env.openaiModel;
  }

  async chatJson(messages: OpenAiChatMessage[], options?: { temperature?: number }): Promise<{
    content: string;
    model: string;
  }> {
    if (!env.openaiApiKey) {
      throw new AppError('AI features are not configured', HTTP_STATUS.SERVICE_UNAVAILABLE);
    }

    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: env.openaiModel,
          temperature: options?.temperature ?? 0.4,
          response_format: { type: 'json_object' },
          messages,
        }),
      });
    } catch {
      throw new AppError(
        'AI service is temporarily unreachable. Please try again.',
        HTTP_STATUS.SERVICE_UNAVAILABLE,
      );
    }

    const raw = (await response.json().catch(() => ({}))) as OpenAiChatCompletionResponse;

    if (!response.ok) {
      const detail = raw.error?.message?.trim() || `OpenAI HTTP ${response.status}`;
      throw new AppError(
        `AI request failed: ${detail}`,
        response.status === 429
          ? HTTP_STATUS.TOO_MANY_REQUESTS
          : HTTP_STATUS.SERVICE_UNAVAILABLE,
      );
    }

    const content = raw.choices?.[0]?.message?.content?.trim() ?? '';
    if (!content) {
      throw new AppError('AI returned an empty response', HTTP_STATUS.SERVICE_UNAVAILABLE);
    }

    return {
      content,
      model: raw.model?.trim() || env.openaiModel,
    };
  }
}

export const openAiService = new OpenAiService();
