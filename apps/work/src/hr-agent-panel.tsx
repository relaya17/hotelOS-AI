import { useState, type FormEvent } from "react";
import { Button, TextField } from "@hotelos/ui";
import { invokeAiGateway } from "@hotelos/web-client";

type ChatTurn = {
  readonly id: string;
  readonly role: "user" | "agent";
  readonly text: string;
};

export function HrAgentPanel() {
  const [message, setMessage] = useState("");
  const [turns, setTurns] = useState<readonly ChatTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(undefined);
    const userTurn: ChatTurn = {
      id: crypto.randomUUID(),
      role: "user",
      text: trimmed,
    };
    setTurns((current) => [...current, userTurn]);
    setMessage("");
    try {
      const result = await invokeAiGateway({
        agentId: "agent.hr",
        message: trimmed,
        locale: "he",
      });
      setTurns((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "agent",
          text: result.answerHe,
        },
      ]);
    } catch (invokeError) {
      setError(
        invokeError instanceof Error
          ? invokeError.message
          : "הסוכן לא זמין כרגע",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="hr-agent" aria-labelledby="hr-agent-title">
      <header className="hr-agent__head">
        <h2 id="hr-agent-title">סוכן HR</h2>
        <p>
          שאלו על נוכחות, מסמכים או תהליכי עובד — התשובה מייעצת; פעולות רגישות
          נשארות אצל המנהל.
        </p>
      </header>

      <ul className="hr-agent__thread">
        {turns.length === 0 ? (
          <li className="hr-agent__empty">
            לדוגמה: «איך מחתים נוכחות?» או «מה צריך להעלות בהרשמה?»
          </li>
        ) : (
          turns.map((turn) => (
            <li
              key={turn.id}
              className={
                turn.role === "user"
                  ? "hr-agent__bubble hr-agent__bubble--user"
                  : "hr-agent__bubble"
              }
            >
              <span className="hr-agent__who">
                {turn.role === "user" ? "אתם" : "סוכן HR"}
              </span>
              <p>{turn.text}</p>
            </li>
          ))
        )}
      </ul>

      <form className="hr-agent__form" onSubmit={onSubmit}>
        <TextField
          label="שאלה לסוכן"
          name="hrMessage"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          required
        />
        {error ? <p className="hr-agent__error">{error}</p> : null}
        <Button type="submit" disabled={loading}>
          {loading ? "חושב…" : "שאל"}
        </Button>
      </form>

      <style>{`
        .hr-agent { display: grid; gap: var(--space-4); }
        .hr-agent__head { display: grid; gap: var(--space-2); }
        .hr-agent__head h2 {
          font-size: clamp(1.35rem, 2.5vw, 1.7rem);
          color: var(--color-sea-deep);
        }
        .hr-agent__head p {
          color: var(--color-ink-soft);
          font-weight: 500;
          line-height: 1.6;
          max-width: 42ch;
        }
        .hr-agent__thread {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 0.85rem;
          min-height: 8rem;
        }
        .hr-agent__empty {
          color: var(--color-ink-faint);
          font-weight: 500;
          line-height: 1.55;
        }
        .hr-agent__bubble {
          display: grid;
          gap: 0.25rem;
          padding-block: 0.65rem;
          border-top: 1px solid var(--color-line);
        }
        .hr-agent__bubble--user { border-top-color: var(--color-sea-soft); }
        .hr-agent__who {
          font-size: var(--text-small);
          font-weight: 700;
          color: var(--color-sea-deep);
        }
        .hr-agent__bubble p {
          margin: 0;
          color: var(--color-ink);
          font-weight: 500;
          line-height: 1.6;
          white-space: pre-wrap;
        }
        .hr-agent__form { display: grid; gap: var(--space-3); }
        .hr-agent__error {
          color: var(--color-danger);
          font-weight: 600;
          font-size: var(--text-small);
        }
      `}</style>
    </section>
  );
}
