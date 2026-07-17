export type AiProviderId = "deterministic" | "openai_compatible";

export type AiGatewayRequest = {
  readonly agentId: string;
  readonly message: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly hotelId?: string;
  readonly locale?: "he" | "en";
  /** Optional operational context pack (already authorized by caller). */
  readonly contextPack?: string;
};

export type AiCitation = {
  readonly title: string;
  readonly url?: string;
  readonly source: "internal" | "trusted" | "company";
};

export type AiGatewayResponse = {
  readonly agentId: string;
  readonly provider: AiProviderId;
  readonly answerHe: string;
  readonly confidence: "high" | "medium" | "low";
  readonly citations: readonly AiCitation[];
  readonly requiresHumanApproval: boolean;
  readonly approvalReasonHe?: string;
  readonly latencyMs: number;
  readonly model?: string;
  readonly usage?: {
    readonly promptTokens?: number;
    readonly completionTokens?: number;
  };
};

export type LlmChatMessage = {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
};

export type LlmCompletionResult = {
  readonly text: string;
  readonly model: string;
  readonly promptTokens?: number;
  readonly completionTokens?: number;
};

export type LlmProvider = {
  readonly id: AiProviderId;
  complete(messages: readonly LlmChatMessage[]): Promise<LlmCompletionResult>;
};
