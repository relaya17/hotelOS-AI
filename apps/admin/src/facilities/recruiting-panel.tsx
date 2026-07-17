import { useEffect, useState, type FormEvent } from "react";
import { Button, TextField } from "@hotelos/ui";
import {
  addJobCandidate,
  createJobPosting,
  listJobCandidates,
  listJobPostings,
  type JobCandidateDto,
  type JobPostingDto,
} from "@hotelos/web-client";

export type RecruitingPanelProps = {
  readonly hotelId: string;
};

const stageLabel: Record<string, string> = {
  applied: "הגיש מועמדות",
  screening: "סינון ראשוני",
  interview: "ראיון",
  offer: "הצעה נשלחה",
  hired: "התקבל/ה",
  rejected: "נדחה/תה",
};

export function RecruitingPanel({ hotelId }: RecruitingPanelProps) {
  const [postings, setPostings] = useState<readonly JobPostingDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const [title, setTitle] = useState("");
  const [boardName, setBoardName] = useState("Yad2");
  const [externalUrl, setExternalUrl] = useState("");
  const [creating, setCreating] = useState(false);

  const [selectedPostingId, setSelectedPostingId] = useState<string | undefined>();
  const [candidates, setCandidates] = useState<readonly JobCandidateDto[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidateName, setCandidateName] = useState("");
  const [candidateSource, setCandidateSource] = useState("Yad2");
  const [addingCandidate, setAddingCandidate] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(undefined);
      try {
        const data = await listJobPostings(hotelId);
        if (!cancelled) setPostings(data);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "שגיאה בטעינה",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  useEffect(() => {
    if (!selectedPostingId) {
      setCandidates([]);
      return;
    }
    const postingId = selectedPostingId;
    let cancelled = false;
    async function loadCandidates() {
      setCandidatesLoading(true);
      try {
        const data = await listJobCandidates(postingId);
        if (!cancelled) setCandidates(data);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "שגיאה בטעינה",
          );
        }
      } finally {
        if (!cancelled) setCandidatesLoading(false);
      }
    }
    void loadCandidates();
    return () => {
      cancelled = true;
    };
  }, [selectedPostingId]);

  async function onCreatePosting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(undefined);
    try {
      const created = await createJobPosting(hotelId, {
        title,
        boardName,
        ...(externalUrl ? { externalUrl } : {}),
      });
      setPostings((prev) => [created, ...prev]);
      setTitle("");
      setExternalUrl("");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "יצירת המשרה נכשלה",
      );
    } finally {
      setCreating(false);
    }
  }

  async function onAddCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPostingId || !candidateName.trim()) return;
    setAddingCandidate(true);
    try {
      const created = await addJobCandidate(selectedPostingId, {
        fullName: candidateName,
        source: candidateSource,
      });
      setCandidates((prev) => [...prev, created]);
      setCandidateName("");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "הוספת המועמד/ת נכשלה",
      );
    } finally {
      setAddingCandidate(false);
    }
  }

  return (
    <div className="panel">
      <p className="disclosure">
        לרוב לוחות הדרושים הישראליים (כולל יד2) אין API ציבורי לפרסום או שאיבת
        מועמדים אוטומטית. הכלי כאן הוא מעקב מבוסס קישורים — מפרסמים ידנית בלוח
        הרצוי, מדביקים כאן את הקישור, ועוקבים אחרי המועמדים שהגיעו.
      </p>

      {loading ? <p className="state">טוען משרות…</p> : null}
      {error !== undefined ? (
        <p className="state state--error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="card">
        <h2>משרות פתוחות</h2>
        <ul className="list">
          {postings.map((posting) => (
            <li key={posting.id} className="row">
              <div>
                <h3>{posting.title}</h3>
                <p>
                  {posting.boardName}
                  {posting.externalUrl ? (
                    <>
                      {" · "}
                      <a href={posting.externalUrl} target="_blank" rel="noreferrer">
                        קישור למודעה
                      </a>
                    </>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                className="mini-btn mini-btn--accent"
                onClick={() =>
                  setSelectedPostingId(
                    selectedPostingId === posting.id ? undefined : posting.id,
                  )
                }
              >
                {selectedPostingId === posting.id ? "סגור מועמדים" : "מועמדים"}
              </button>
            </li>
          ))}
        </ul>

        <form className="create-form" onSubmit={onCreatePosting} noValidate>
          <h3>משרה חדשה</h3>
          <TextField
            label="תפקיד"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <TextField
            label="לוח דרושים"
            name="boardName"
            value={boardName}
            onChange={(e) => setBoardName(e.target.value)}
            placeholder="Yad2, LinkedIn, JobMaster…"
            required
          />
          <TextField
            label="קישור למודעה (אופציונלי)"
            name="externalUrl"
            type="url"
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="https://www.yad2.co.il/..."
          />
          <Button type="submit" disabled={creating}>
            {creating ? "יוצר…" : "צור משרה"}
          </Button>
        </form>
      </section>

      {selectedPostingId ? (
        <section className="card">
          <h2>מועמדים</h2>
          {candidatesLoading ? <p className="state">טוען מועמדים…</p> : null}
          {!candidatesLoading && candidates.length === 0 ? (
            <p className="hint">עדיין אין מועמדים רשומים למשרה זו.</p>
          ) : null}
          <ul className="list">
            {candidates.map((candidate) => (
              <li key={candidate.id} className="row">
                <div>
                  <h3>{candidate.fullName}</h3>
                  <p>{candidate.source}</p>
                </div>
                <span className="status">
                  {stageLabel[candidate.stage] ?? candidate.stage}
                </span>
              </li>
            ))}
          </ul>

          <form className="create-form" onSubmit={onAddCandidate} noValidate>
            <h3>מועמד/ת חדש/ה</h3>
            <TextField
              label="שם מלא"
              name="candidateName"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              required
            />
            <TextField
              label="מקור (לוח / הפניה)"
              name="candidateSource"
              value={candidateSource}
              onChange={(e) => setCandidateSource(e.target.value)}
              required
            />
            <Button type="submit" disabled={addingCandidate}>
              {addingCandidate ? "מוסיף…" : "הוסף מועמד/ת"}
            </Button>
          </form>
        </section>
      ) : null}

      <style>{`
        .panel { display:grid; gap:var(--space-4); }
        .disclosure { margin:0; padding:var(--space-3) var(--space-4); border:1px solid rgb(15 106 92 / 20%); background:rgb(15 106 92 / 6%); border-radius:var(--radius-sm); color:var(--color-ink-soft); font-size:var(--text-small); }
        .card { background:rgb(255 250 242 / 90%); border:1px solid rgb(16 36 31 / 10%); border-radius:calc(var(--radius-md) + .1rem); box-shadow:var(--shadow-soft); padding:clamp(1.2rem,2.5vw,1.8rem); display:grid; gap:var(--space-4); }
        .card h2 { margin:0; font-size:var(--text-title); }
        .hint { margin:0; color:var(--color-ink-soft); }
        .list { list-style:none; margin:0; padding:0; display:grid; gap:var(--space-3); }
        .row { display:flex; justify-content:space-between; gap:var(--space-3); align-items:center; padding:var(--space-4); border:1px solid rgb(16 36 31 / 10%); border-radius:var(--radius-sm); background:var(--color-paper-elevated); }
        .row h3 { margin:0; font-family:var(--font-display); font-size:1.1rem; }
        .row p { margin:var(--space-1) 0 0; color:var(--color-ink-soft); font-size:var(--text-small); }
        .row p a { color:var(--color-sea-deep); font-weight:600; }
        .status { font-size:var(--text-small); font-weight:700; padding:.35rem .7rem; border-radius:999px; white-space:nowrap; color:#1f4b7a; background:rgb(31 75 122 / 12%); }
        .mini-btn { font:inherit; font-size:var(--text-small); border:1px solid rgb(16 36 31 / 18%); background:transparent; border-radius:var(--radius-sm); padding:.3rem .6rem; cursor:pointer; font-weight:600; }
        .mini-btn--accent { border-color:var(--color-sea-deep); color:var(--color-sea-deep); }
        .create-form { display:grid; gap:var(--space-3); border-top:1px solid rgb(16 36 31 / 10%); padding-top:var(--space-4); }
        .create-form h3 { margin:0; font-family:var(--font-display); }
        .state { margin:0; color:var(--color-ink-soft); }
        .state--error { color:var(--color-danger); }
      `}</style>
    </div>
  );
}
