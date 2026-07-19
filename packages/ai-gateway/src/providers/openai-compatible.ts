import type {
  LlmChatMessage,
  LlmCompletionResult,
  LlmEmbeddingResult,
  LlmProvider,
} from "../types.js";

export type OpenAiCompatibleConfig = {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
  /** Defaults to text-embedding-3-small when omitted. */
  readonly embedModel?: string;
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

type EmbeddingsResponse = {
  readonly data?: readonly {
    readonly embedding?: readonly number[];
    readonly index?: number;
  }[];
  readonly model?: string;
};

/**
 * OpenAI-compatible Chat Completions + Embeddings
 * (OpenAI, Azure OpenAI with compatible path, etc.).
 */
export function createOpenAiCompatibleProvider(
  config: OpenAiCompatibleConfig,
): LlmProvider {
  const base = config.baseUrl.replace(/\/$/, "");
  const embedModel = config.embedModel?.trim() || "text-embedding-3-small";
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };

  return {
    id: "openai_compatible",
    async complete(messages: readonly LlmChatMessage[]): Promise<LlmCompletionResult> {
      const response = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: authHeaders,
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

    async embed(texts: readonly string[]): Promise<LlmEmbeddingResult> {
      if (texts.length === 0) {
        return { vectors: [], model: embedModel };
      }

      const response = await fetch(`${base}/embeddings`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          model: embedModel,
          input: [...texts],
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Embedding provider HTTP ${response.status}: ${body.slice(0, 400)}`,
        );
      }

      const payload = (await response.json()) as EmbeddingsResponse;
      const sorted = [...(payload.data ?? [])].sort(
        (a, b) => (a.index ?? 0) - (b.index ?? 0),
      );
      const vectors = sorted.map((row) => row.embedding ?? []);
      if (vectors.length !== texts.length || vectors.some((v) => v.length === 0)) {
        throw new Error("Embedding provider returned incomplete vectors");
      }

      return {
        vectors,
        model: payload.model ?? embedModel,
      };
    },
  };
}
