import type { LlmChatMessage, LlmCompletionResult, LlmProvider } from "../types.js";

export type OpenAiCompatibleConfig = {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
};

type ChatCompletionsResponse = {
  readonly choices?: readonly {
    readonly message?: { readonly content?: string | null };
  }[];
  readonly model?: string;
  readonly usage?: {
    readonly prompt_tokens?: number;
    readonly completion_tokens?: number;
  };
};

/**
 * OpenAI-compatible Chat Completions (OpenAI, Azure OpenAI with compatible path, etc.).
 */
export function createOpenAiCompatibleProvider(
  config: OpenAiCompatibleConfig,
): LlmProvider {
  const base = config.baseUrl.replace(/\/$/, "");
  return {
    id: "openai_compatible",
    async complete(messages: readonly LlmChatMessage[]): Promise<LlmCompletionResult> {
      const response = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `LLM provider HTTP ${response.status}: ${body.slice(0, 400)}`,
        );
      }

      const payload = (await response.json()) as ChatCompletionsResponse;
      const text = payload.choices?.[0]?.message?.content?.trim();
      if (!text) {
        throw new Error("LLM provider returned empty content");
      }

      return {
        text,
        model: payload.model ?? config.model,
        ...(payload.usage?.prompt_tokens !== undefined
          ? { promptTokens: payload.usage.prompt_tokens }
          : {}),
        ...(payload.usage?.completion_tokens !== undefined
          ? { completionTokens: payload.usage.completion_tokens }
          : {}),
      };
    },
  };
}
