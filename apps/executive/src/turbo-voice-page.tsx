import { useEffect, useRef, useState } from "react";
import { tUi, type LocaleCode } from "@hotelos/i18n";
import { Button } from "@hotelos/ui";
import {
  submitVoiceIntent,
  type VoiceIntentDto,
} from "@hotelos/web-client";

export type TurboVoicePageProps = {
  readonly locale: LocaleCode;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
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

export function TurboVoicePage({ locale }: TurboVoicePageProps) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<VoiceIntentDto | null>(null);
  const [error, setError] = useState<string | undefined>();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  async function processTranscript(text: string) {
    setTranscript(text);
    setError(undefined);
    try {
      setResult(await submitVoiceIntent(text));
    } catch (voiceError) {
      setError(
        voiceError instanceof Error ? voiceError.message : "Voice failed",
      );
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
      setError(
        "הדפדפן לא תומך בזיהוי קול — אפשר להקליד כוונה ידנית למטה",
      );
      return;
    }
    recognition.lang = locale === "he" || locale === "ar" ? locale : "he-IL";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript ?? "";
      void processTranscript(text);
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
    <div className="page">
      <header>
        <p className="eyebrow">Turbo OS · Agent</p>
        <h1>{tUi(locale, "voice.title")}</h1>
        <p className="sub">
          זיהוי קול → כוונה → אוטומציה מלאה (כספים / ניקיון / תרגום / חשבונאות)
        </p>
      </header>

      <section className="card">
        <Button type="button" onClick={toggleListen}>
          {listening
            ? tUi(locale, "voice.listening")
            : tUi(locale, "voice.listen")}
        </Button>
        <label className="manual">
          <span>או הקלידו כוונה</span>
          <input
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
            placeholder="לדוגמה: פתח ועדת כספים"
          />
        </label>
        <Button
          type="button"
          variant="ghost"
          disabled={!transcript.trim()}
          onClick={() => {
            void processTranscript(transcript);
          }}
        >
          הפעל אוטומציה
        </Button>
        {error !== undefined ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      {result ? (
        <section className="card result">
          <h2>{result.intent}</h2>
          <p>{locale === "en" ? result.replyEn : result.replyHe}</p>
          <dl>
            <div>
              <dt>Action</dt>
              <dd>{result.action}</dd>
            </div>
            <div>
              <dt>Automation</dt>
              <dd>{result.automationId ?? "—"}</dd>
            </div>
            <div>
              <dt>Run</dt>
              <dd>{result.runId ?? "—"}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <style>{`
        .page{display:grid;gap:var(--space-4)}
        .eyebrow{margin:0 0 var(--space-2);letter-spacing:.08em;text-transform:uppercase;font-size:var(--text-small);color:var(--color-sea-deep);font-weight:700}
        h1{margin:0;font-size:clamp(1.8rem,3vw,2.6rem)}
        .sub{margin:var(--space-2) 0 0;color:var(--color-ink-soft)}
        .card{background:rgb(255 250 242 / 92%);border:1px solid rgb(16 36 31 / 10%);border-radius:var(--radius-md);padding:var(--space-4);display:grid;gap:var(--space-3);box-shadow:var(--shadow-soft)}
        .manual{display:grid;gap:var(--space-2)}
        .manual span{font-size:var(--text-small);font-weight:600;color:var(--color-ink-soft)}
        .manual input{font:inherit;padding:.85rem .95rem;border-radius:var(--radius-sm);border:1px solid rgb(16 36 31 / 18%);background:var(--color-paper-elevated)}
        .result h2{margin:0;font-family:var(--font-display)}
        .result p{margin:0;color:var(--color-ink-soft)}
        dl{margin:0;display:grid;gap:var(--space-2)}
        dt{font-size:var(--text-small);color:var(--color-ink-soft)}
        dd{margin:0;font-weight:700}
        .err{color:var(--color-danger);margin:0}
      `}</style>
    </div>
  );
}
