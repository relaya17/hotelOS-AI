import type { LlmChatMessage, LlmCompletionResult, LlmProvider } from "../types.js";

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
  };
}
