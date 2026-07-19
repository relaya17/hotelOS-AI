import { useEffect, useState, type FormEvent } from "react";
import { Button, TextField } from "@hotelos/ui";
import {
  addJobCandidate,
  closeJobPosting,
  createJobPosting,
  listJobCandidates,
  listJobPostings,
  suggestAutonomyRecruitingStage,
  updateJobCandidateStage,
  type CandidateStage,
  type JobCandidateDto,
  type JobPostingDto,
} from "@hotelos/web-client";

export type RecruitingPanelProps = {
  readonly hotelId: string;
};

const stageLabel: Record<CandidateStage, string> = {
  applied: "הגיש מועמדות",
  screening: "סינון ראשוני",
  interview: "ראיון",
  offer: "הצעה נשלחה",
  hired: "התקבל/ה",
  rejected: "נדחה/תה",
};

const directStages: readonly Exclude<CandidateStage, "offer" | "hired">[] = [
  "applied",
  "screening",
  "interview",
  "rejected",
];

export function RecruitingPanel({ hotelId }: RecruitingPanelProps) {
  const [postings, setPostings] = useState<readonly JobPostingDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();

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
  const [busyCandidateId, setBusyCandidateId] = useState<string | undefined>();
  const [closingPostingId, setClosingPostingId] = useState<string | undefined>();

  async function reloadPostings() {
    const data = await listJobPostings(hotelId);
    setPostings(data);
  }

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
        const data = await listJobCandidates(hotelId, postingId);
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
  }, [hotelId, selectedPostingId]);

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
      const created = await addJobCandidate(hotelId, selectedPostingId, {
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

  async function onClosePosting(postingId: string) {
    setClosingPostingId(postingId);
    setError(undefined);
    try {
      const closed = await closeJobPosting(hotelId, postingId);
      setPostings((prev) =>
        prev.map((p) => (p.id === closed.id ? closed : p)),
      );
      setNotice(`משרה «${closed.title}» נסגרה.`);
      if (selectedPostingId === postingId) setSelectedPostingId(undefined);
    } catch (closeError) {
      setError(
        closeError instanceof Error ? closeError.message : "סגירת משרה נכשלה",
      );
    } finally {
      setClosingPostingId(undefined);
    }
  }

  async function onDirectStage(
    candidateId: string,
    stage: Exclude<CandidateStage, "offer" | "hired">,
  ) {
    setBusyCandidateId(candidateId);
    setError(undefined);
    try {
      const updated = await updateJobCandidateStage(
        hotelId,
        candidateId,
        stage,
      );
      setCandidates((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)),
      );
    } catch (stageError) {
      setError(
        stageError instanceof Error ? stageError.message : "עדכון שלב נכשל",
      );
    } finally {
      setBusyCandidateId(undefined);
    }
  }

  async function onSuggestHitl(
    candidateId: string,
    stage: "offer" | "hired",
  ) {
    setBusyCandidateId(candidateId);
    setError(undefined);
    try {
      const result = await suggestAutonomyRecruitingStage({
        hotelId,
        candidateId,
        stage,
      });
      setNotice(
        `Suggest ל«${stageLabel[stage]}» נשלח לאישורי AI (${result.approvalId.slice(0, 8)}…). אשרו → Act יעדכן שלב.`,
      );
      await reloadPostings();
    } catch (suggestError) {
      setError(
        suggestError instanceof Error
          ? suggestError.message
          : "הצעת שלב לאישור נכשלה",
      );
    } finally {
      setBusyCandidateId(undefined);
    }
  }

  const selectedPosting = postings.find((p) => p.id === selectedPostingId);

  return (
    <div className="panel">
      <p className="disclosure">
        מעקב גיוס קיים: שלבים ישירים (סינון/ראיון/דחייה) מיידיים; הצעה/קבלה
        עוברות Suggest→Approve→Act בתיבת אישורי AI (בלי חוזה/משתמש אוטומטי).
      </p>

      {loading ? <p className="state">טוען משרות…</p> : null}
      {error !== undefined ? (
        <p className="state state--error" role="alert">
          {error}
        </p>
      ) : null}
      {notice !== undefined ? (
        <p className="state state--ok" role="status">
          {notice}
        </p>
      ) : null}

      <section className="card">
        <h2>משרות</h2>
        <ul className="list">
          {postings.map((posting) => (
            <li key={posting.id} className="row">
              <div>
                <h3>{posting.title}</h3>
                <p>
                  {posting.boardName}
                  {posting.status === "closed" ? " · סגורה" : " · פתוחה"}
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
              <div className="row__actions">
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
                {posting.status === "open" ? (
                  <button
                    type="button"
                    className="mini-btn"
                    disabled={closingPostingId === posting.id}
                    onClick={() => void onClosePosting(posting.id)}
                  >
                    {closingPostingId === posting.id ? "סוגר…" : "סגור משרה"}
                  </button>
                ) : null}
              </div>
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
          <h2>מועמדים · {selectedPosting?.title ?? ""}</h2>
          {selectedPosting?.status === "closed" ? (
            <p className="hint">משרה סגורה — לא ניתן לעדכן מועמדים.</p>
          ) : null}
          {candidatesLoading ? <p className="state">טוען מועמדים…</p> : null}
          {!candidatesLoading && candidates.length === 0 ? (
            <p className="hint">עדיין אין מועמדים רשומים למשרה זו.</p>
          ) : null}
          <ul className="list">
            {candidates.map((candidate) => (
              <li key={candidate.id} className="candidate">
                <div className="candidate__head">
                  <div>
                    <h3>{candidate.fullName}</h3>
                    <p>{candidate.source}</p>
                  </div>
                  <span className="status">
                    {stageLabel[candidate.stage] ?? candidate.stage}
                  </span>
                </div>
                {selectedPosting?.status === "open" ? (
                  <div className="candidate__actions">
                    <label>
                      שלב ישיר
                      <select
                        value={
                          directStages.includes(
                            candidate.stage as (typeof directStages)[number],
                          )
                            ? candidate.stage
                            : "interview"
                        }
                        disabled={busyCandidateId === candidate.id}
                        onChange={(e) =>
                          void onDirectStage(
                            candidate.id,
                            e.target.value as (typeof directStages)[number],
                          )
                        }
                      >
                        {directStages.map((stage) => (
                          <option key={stage} value={stage}>
                            {stageLabel[stage]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button
                      type="button"
                      disabled={
                        busyCandidateId === candidate.id ||
                        candidate.stage === "offer"
                      }
                      onClick={() => void onSuggestHitl(candidate.id, "offer")}
                    >
                      הצע Offer (Suggest)
                    </Button>
                    <Button
                      type="button"
                      disabled={
                        busyCandidateId === candidate.id ||
                        candidate.stage === "hired"
                      }
                      onClick={() => void onSuggestHitl(candidate.id, "hired")}
                    >
                      הצע Hired (Suggest)
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>

          {selectedPosting?.status === "open" ? (
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
          ) : null}
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
        .row h3,.candidate h3 { margin:0; font-family:var(--font-display); font-size:1.1rem; }
        .row p,.candidate p { margin:var(--space-1) 0 0; color:var(--color-ink-soft); font-size:var(--text-small); }
        .row p a { color:var(--color-sea-deep); font-weight:600; }
        .row__actions { display:flex; flex-direction:column; gap:var(--space-2); align-items:flex-end; }
        .candidate { display:grid; gap:var(--space-3); padding:var(--space-4); border:1px solid rgb(16 36 31 / 10%); border-radius:var(--radius-sm); background:var(--color-paper-elevated); }
        .candidate__head { display:flex; justify-content:space-between; gap:var(--space-3); align-items:center; }
        .candidate__actions { display:flex; flex-wrap:wrap; gap:var(--space-2); align-items:end; }
        .candidate__actions label { display:grid; gap:.25rem; font-size:var(--text-small); }
        .candidate__actions select { font:inherit; padding:.4rem .55rem; }
        .status { font-size:var(--text-small); font-weight:700; padding:.35rem .7rem; border-radius:999px; white-space:nowrap; color:#1f4b7a; background:rgb(31 75 122 / 12%); }
        .mini-btn { font:inherit; font-size:var(--text-small); border:1px solid rgb(16 36 31 / 18%); background:transparent; border-radius:var(--radius-sm); padding:.3rem .6rem; cursor:pointer; font-weight:600; }
        .mini-btn--accent { border-color:var(--color-sea-deep); color:var(--color-sea-deep); }
        .create-form { display:grid; gap:var(--space-3); border-top:1px solid rgb(16 36 31 / 10%); padding-top:var(--space-4); }
        .create-form h3 { margin:0; font-family:var(--font-display); }
        .state { margin:0; color:var(--color-ink-soft); }
        .state--error { color:var(--color-danger); }
        .state--ok { color:#0f6a5c; background:rgb(15 106 92 / 10%); padding:.75rem 1rem; border-radius:var(--radius-sm); }
      `}</style>
    </div>
  );
}
