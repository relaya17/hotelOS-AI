import type {
  LlmChatMessage,
  LlmCompletionResult,
  LlmEmbeddingResult,
  LlmProvider,
} from "../types.js";

const DETERMINISTIC_EMBED_DIMS = 64;

/**
 * Always-on provider — no external network. Used when no LLM key is configured,
 * and as fallback if the remote provider fails.
 */
export function createDeterministicProvider(): LlmProvider {
  return {
    id: "deterministic",
    async complete(messages: readonly LlmChatMessage[]): Promise<LlmCompletionResult> {
      const user = [...messages].reverse().find((m) => m.role === "user");
      const question = user?.content.trim() ?? "";
      const system = messages.find((m) => m.role === "system")?.content ?? "";
      const agentMatch = /Agent:\s*(\S+)/.exec(system);
      const agentId = agentMatch?.[1] ?? "agent.cio";

      const isDailyDigest = /תדריך יומי|המלצות להיום/i.test(question);
      const answerHe = isDailyDigest
        ? [
            `תשובת Gateway (${agentId}, מצב דטרמיניסטי):`,
            "סיכום יומי מבוסס נתוני תפעול מהקשר — בלי ביצוע כספי.",
            "בדקו תפוסה, תחזוקה פתוחה, מלאי נמוך והזמנות רכש ממתינות.",
            "המלצות להיום:",
            "• לעבור על קריאות תחזוקה דחופות",
            "• לאשר/לדחות הצעות מחיר ממתינות בתיבת AI",
            "• להשלים מלאי מתחת לסף דרך Suggest רכש",
            "כדי לקבל ניסוח LLM מלא הגדירו AI_GATEWAY_API_KEY ב־.env.",
          ].join("\n")
        : [
            `תשובת Gateway (${agentId}, מצב דטרמיניסטי):`,
            question.length > 0
              ? `קיבלתי: «${question.slice(0, 280)}»`
              : "לא התקבלה שאלה.",
            "כדי לקבל ניסוח LLM מלא הגדירו AI_GATEWAY_API_KEY (או Azure OpenAI) ב־.env.",
            "בינתיים: השתמשו בתדריך CIO, Trusted Knowledge, וספי אישור אנושי (₪2,000 / 5%).",
          ].join("\n");

      return {
        text: answerHe,
        model: "hotelos.deterministic.v1",
        promptTokens: Math.ceil(question.length / 4),
        completionTokens: Math.ceil(answerHe.length / 4),
      };
    },

    async embed(texts: readonly string[]): Promise<LlmEmbeddingResult> {
      return {
        vectors: texts.map((text) => deterministicEmbed(text)),
        model: "hotelos.deterministic.embed.v1",
      };
    },
  };
}

/** Stable bag-of-char / bigram hash vector — similar texts share some mass. */
export function deterministicEmbed(
  text: string,
  dims = DETERMINISTIC_EMBED_DIMS,
): number[] {
  const vec = new Array<number>(dims).fill(0);
  const normalized = text.toLowerCase();
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    vec[code % dims]! += 1;
    if (i + 1 < normalized.length) {
      const bigram = code * 31 + normalized.charCodeAt(i + 1);
      vec[Math.abs(bigram) % dims]! += 0.5;
    }
  }
  const norm = Math.sqrt(vec.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vec.map((value) => value / norm);
}
