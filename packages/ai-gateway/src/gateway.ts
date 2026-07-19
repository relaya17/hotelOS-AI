import type {
  AiCitation,
  AiGatewayRequest,
  AiGatewayResponse,
  LlmEmbeddingResult,
  LlmProvider,
} from "./types.js";
import { createDeterministicProvider } from "./providers/deterministic.js";
import {
  createOpenAiCompatibleProvider,
  type OpenAiCompatibleConfig,
} from "./providers/openai-compatible.js";

const MONEY_HINT =
  /העבר|זיכוי|תשלום|תקציב|מחיר|הנחה|refund|transfer|payment|budget|price/i;

export type GatewayAgent = {
  readonly id: string;
  readonly nameHe: string;
  readonly domain: string;
  readonly autonomyMode: "suggest" | "approve" | "act";
};

export type AiGateway = {
  readonly primaryProvider: LlmProvider["id"];
  invoke(request: AiGatewayRequest): Promise<AiGatewayResponse>;
  /** Embedding via AI Platform only — used by API to build authorized packs. */
  embed(texts: readonly string[]): Promise<LlmEmbeddingResult>;
};

export type CreateAiGatewayOptions = {
  readonly agents: readonly GatewayAgent[];
  readonly openai?: OpenAiCompatibleConfig;
  readonly onAudit?: (event: {
    readonly action: string;
    readonly agentId: string;
    readonly tenantId: string;
    readonly userId: string;
    readonly provider: string;
    readonly ok: boolean;
    readonly detail: string;
  }) => Promise<void> | void;
};

function buildSystemPrompt(input: {
  readonly agentId: string;
  readonly agentNameHe: string;
  readonly domain: string;
  readonly contextPack?: string;
  readonly locale: "he" | "en";
}): string {
  const lang =
    input.locale === "he"
      ? "ענה בעברית תמציתית ומקצועית."
      : "Answer in clear professional English.";
  return [
    `You are HotelOS AI Gateway.`,
    `Agent: ${input.agentId} (${input.agentNameHe})`,
    `Domain: ${input.domain}`,
    "Rules:",
    "- Never invent tools or claim money was moved.",
    "- Flag human approval when money/policy changes are implied (threshold ₪2,000 or 5% ADR).",
    "- Prefer citations from Trusted/Internal context when provided.",
    "- If unsure, say so and recommend human review.",
    lang,
    input.contextPack
      ? `Authorized context pack:\n${input.contextPack}`
      : "No extra context pack.",
  ].join("\n");
}

export function createAiGateway(options: CreateAiGatewayOptions): AiGateway {
  const deterministic = createDeterministicProvider();
  const remote =
    options.openai !== undefined
      ? createOpenAiCompatibleProvider(options.openai)
      : undefined;
  const byId = new Map(options.agents.map((agent) => [agent.id, agent]));

  return {
    primaryProvider: remote?.id ?? deterministic.id,

    async embed(texts: readonly string[]): Promise<LlmEmbeddingResult> {
      let provider: LlmProvider = remote ?? deterministic;
      try {
        return await provider.embed(texts);
      } catch (error) {
        if (provider.id !== "deterministic") {
          provider = deterministic;
          return provider.embed(texts);
        }
        throw error;
      }
    },

    async invoke(request: AiGatewayRequest): Promise<AiGatewayResponse> {
      const started = Date.now();
      const agent = byId.get(request.agentId);
      if (!agent) {
        throw new Error(`Unknown agentId: ${request.agentId}`);
      }

      const locale = request.locale ?? "he";
      const messages = [
        {
          role: "system" as const,
          content: buildSystemPrompt({
            agentId: agent.id,
            agentNameHe: agent.nameHe,
            domain: agent.domain,
            ...(request.contextPack !== undefined
              ? { contextPack: request.contextPack }
              : {}),
            locale,
          }),
        },
        { role: "user" as const, content: request.message },
      ];

      let provider: LlmProvider = remote ?? deterministic;
      let completion;
      try {
        completion = await provider.complete(messages);
      } catch (error) {
        if (provider.id !== "deterministic") {
          provider = deterministic;
          completion = await provider.complete(messages);
          await options.onAudit?.({
            action: "ai.gateway.fallback",
            agentId: agent.id,
            tenantId: request.tenantId,
            userId: request.userId,
            provider: provider.id,
            ok: true,
            detail:
              error instanceof Error ? error.message : "remote provider failed",
          });
        } else {
          throw error;
        }
      }

      const requiresHumanApproval =
        agent.autonomyMode === "suggest" || MONEY_HINT.test(request.message);
      const citations: AiCitation[] = request.contextPack
        ? [
            {
              title: "Authorized context pack",
              source: "internal",
            },
          ]
        : [];

      const response: AiGatewayResponse = {
        agentId: agent.id,
        provider: provider.id,
        answerHe: completion.text,
        confidence: provider.id === "deterministic" ? "medium" : "high",
        citations,
        requiresHumanApproval,
        ...(requiresHumanApproval
          ? {
              approvalReasonHe:
                "פעולות כספיות/מדיניות דורשות אישור אדם (סף ₪2,000 או 5% ADR).",
            }
          : {}),
        latencyMs: Date.now() - started,
        model: completion.model,
        ...(completion.promptTokens !== undefined ||
        completion.completionTokens !== undefined
          ? {
              usage: {
                ...(completion.promptTokens !== undefined
                  ? { promptTokens: completion.promptTokens }
                  : {}),
                ...(completion.completionTokens !== undefined
                  ? { completionTokens: completion.completionTokens }
                  : {}),
              },
            }
          : {}),
      };

      await options.onAudit?.({
        action: "ai.gateway.invoke",
        agentId: agent.id,
        tenantId: request.tenantId,
        userId: request.userId,
        provider: provider.id,
        ok: true,
        detail: `latencyMs=${response.latencyMs}; model=${completion.model}`,
      });

      return response;
    },
  };
}
