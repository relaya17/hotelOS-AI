import { useEffect, useRef, useState } from "react";
import { Button, TextField } from "@hotelos/ui";
import {
  invokePublicBookAssistant,
  type PublicBookAssistantResultDto,
  type PublicBookDraftDto,
} from "@hotelos/web-client";

export type VoiceBookAssistantProps = {
  readonly onCancel: () => void;
  readonly onBooked: (input: {
    readonly email: string;
    readonly bookingId: string;
  }) => void;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognition(): SpeechRecognitionLike | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

type ChatTurn = {
  readonly role: "user" | "agent";
  readonly text: string;
};

export function VoiceBookAssistant({
  onCancel,
  onBooked,
}: VoiceBookAssistantProps) {
  const [draft, setDraft] = useState<PublicBookDraftDto>({});
  const [turns, setTurns] = useState<readonly ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [latest, setLatest] = useState<PublicBookAssistantResultDto | null>(
    null,
  );
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setBusy(true);
      try {
        const result = await invokePublicBookAssistant({ message: "", draft: {} });
        if (cancelled) return;
        setDraft(result.draft);
        setLatest(result);
        setTurns([{ role: "agent", text: result.replyHe }]);
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "הסוכן לא זמין כרגע",
          );
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, latest]);

  async function sendMessage(
    message: string,
    options?: { readonly confirm?: boolean; readonly silentUser?: boolean },
  ) {
    setBusy(true);
    setError(undefined);
    if (!options?.silentUser && message.trim()) {
      setTurns((prev) => [...prev, { role: "user", text: message.trim() }]);
    }
    try {
      const result = await invokePublicBookAssistant({
        message,
        draft,
        ...(options?.confirm !== undefined
          ? { confirm: options.confirm }
          : {}),
      });
      setDraft(result.draft);
      setLatest(result);
      setTurns((prev) => [...prev, { role: "agent", text: result.replyHe }]);
      if (result.booked) {
        onBooked({
          email: result.booked.guestEmail,
          bookingId: result.booked.bookingId,
        });
      }
    } catch (sendError: unknown) {
      setError(
        sendError instanceof Error ? sendError.message : "הסוכן לא זמין כרגע",
      );
    } finally {
      setBusy(false);
      setInput("");
    }
  }

  function toggleListen() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = getRecognition();
    if (!recognition) {
      setError("הדפדפן לא תומך בזיהוי קול — אפשר לכתוב במקום.");
      return;
    }
    recognition.lang = "he-IL";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript ?? "";
      if (text.trim()) void sendMessage(text);
    };
    recognition.onerror = (event) => {
      setError(event.error);
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  return (
    <div className="vba">
      <header className="vba__header">
        <div>
          <p className="hotelos-eyebrow">סוכן הזמנות · קול + שיחה</p>
          <h1>דברו — אנחנו ממלאים</h1>
          <p className="sub">
            בלי טפסים ארוכים. אמרו תאריכים, סוג חדר ופרטי קשר. לפני החיוב תאשרו
            במילה אחת.
          </p>
        </div>
        <Button type="button" variant="ghost" onClick={onCancel}>
          חזרה
        </Button>
      </header>

      <section className="vba__chat" aria-live="polite">
        {turns.map((turn, index) => (
          <div
            key={`${turn.role}-${index}`}
            className={
              turn.role === "user" ? "vba-bubble vba-bubble--user" : "vba-bubble"
            }
          >
            <p>{turn.text}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </section>

      {latest?.offers && latest.offers.length > 0 ? (
        <ul className="vba-offers" aria-label="הצעות זמינות">
          {latest.offers.map((offer) => (
            <li key={offer.roomType}>
              <strong>{offer.labelHe}</strong>
              <span>
                {offer.availableCount} פנויים · ₪{Math.round(offer.total)}
              </span>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  void sendMessage(`אני רוצה חדר ${offer.labelHe}`)
                }
              >
                בחר
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {latest?.readyToConfirm ? (
        <div className="vba-confirm">
          <p>
            מוכן לאישור · {latest.draft.checkInDate} → {latest.draft.checkOutDate}{" "}
            · {latest.draft.guestName}
          </p>
          <Button
            type="button"
            disabled={busy}
            onClick={() => void sendMessage("כן, אשר הזמנה", { confirm: true })}
          >
            אשר והזמן (תשלום דמו — בלי PAN)
          </Button>
        </div>
      ) : null}

      {error ? (
        <p className="state state--err" role="alert">
          {error}
        </p>
      ) : null}

      <form
        className="vba__compose"
        onSubmit={(event) => {
          event.preventDefault();
          if (!input.trim() || busy) return;
          void sendMessage(input);
        }}
      >
        <TextField
          label="כתבו או דברו"
          name="voiceBook"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder='למשל: מחר ליומיים, דלוקס, שמי רחל, rachel@demo.com'
        />
        <div className="vba__actions">
          <Button type="button" variant="ghost" onClick={toggleListen}>
            {listening ? "מאזין…" : "דיבור"}
          </Button>
          <Button type="submit" disabled={busy || input.trim().length === 0}>
            {busy ? "מעדכן…" : "שלח"}
          </Button>
        </div>
      </form>

      <style>{`
        .vba { display:grid; gap:var(--space-4); width:min(100%,40rem); margin-inline:auto; padding:var(--space-page); animation:hotelos-enter var(--motion-med) var(--ease-out) both; }
        .vba__header { display:flex; justify-content:space-between; gap:var(--space-3); align-items:start; }
        .vba__header h1 { margin:0; font-size:clamp(1.6rem,4vw,2.2rem); }
        .vba .sub { margin:var(--space-2) 0 0; color:var(--color-ink-soft); max-width:40ch; }
        .vba__chat { display:grid; gap:var(--space-2); min-height:12rem; max-height:min(50vh,28rem); overflow:auto; padding:var(--space-3); border:1px solid var(--color-line); border-radius:var(--radius-md); background:var(--color-paper-elevated); }
        .vba-bubble { justify-self:start; max-width:90%; padding:.75rem 1rem; border-radius:1rem; background:color-mix(in oklab, var(--color-sea-deep) 8%, #fff); white-space:pre-wrap; }
        .vba-bubble p { margin:0; line-height:1.45; }
        .vba-bubble--user { justify-self:end; background:color-mix(in oklab, var(--color-sea-deep) 18%, #fff); font-weight:600; }
        .vba-offers { list-style:none; margin:0; padding:0; display:grid; gap:var(--space-2); }
        .vba-offers li { display:grid; grid-template-columns:1fr auto auto; gap:var(--space-2); align-items:center; padding:var(--space-3); border:1px solid var(--color-line); border-radius:var(--radius-sm); }
        .vba-confirm { display:flex; flex-wrap:wrap; gap:var(--space-3); align-items:center; justify-content:space-between; padding:var(--space-4); border:1px solid var(--color-line-strong); border-radius:var(--radius-md); background:color-mix(in oklab, var(--color-sea-deep) 6%, #fff); }
        .vba-confirm p { margin:0; font-weight:600; }
        .vba__compose { display:grid; gap:var(--space-3); }
        .vba__actions { display:flex; gap:var(--space-2); justify-content:flex-end; }
        .state--err { color:var(--color-danger); margin:0; }
        @media (max-width:560px) {
          .vba-offers li { grid-template-columns:1fr; }
          .vba__header { flex-direction:column; }
        }
      `}</style>
    </div>
  );
}
