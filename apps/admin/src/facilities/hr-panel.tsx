import { useEffect, useState, type FormEvent } from "react";
import { Button, TextField } from "@hotelos/ui";
import {
  assignAssessment,
  createHrInvite,
  createLetterDraft,
  listAssessmentTemplates,
  listEmployeeAssessments,
  listHrEmployees,
  listHrInvites,
  listLetterDrafts,
  type AssessmentTemplateDto,
  type HrEmployeeDto,
  type HrInviteDto,
  type LetterDraftDto,
} from "@hotelos/web-client";

export type HrPanelProps = {
  readonly hotelId: string;
};

export function HrPanel({ hotelId }: HrPanelProps) {
  const [employees, setEmployees] = useState<readonly HrEmployeeDto[]>([]);
  const [invites, setInvites] = useState<readonly HrInviteDto[]>([]);
  const [drafts, setDrafts] = useState<readonly LetterDraftDto[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [displayNameHint, setDisplayNameHint] = useState("");
  const [roleHint, setRoleHint] = useState("עובד/ת");
  const [lastToken, setLastToken] = useState<string | undefined>();
  const [letterSubject, setLetterSubject] = useState("");
  const [letterRecipient, setLetterRecipient] = useState("");
  const [letterNotes, setLetterNotes] = useState("");
  const [templates, setTemplates] = useState<readonly AssessmentTemplateDto[]>(
    [],
  );
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [employeeAssessments, setEmployeeAssessments] = useState<
    readonly { readonly id: string; readonly status: string; readonly titleHe?: string }[]
  >([]);

  async function reload() {
    setLoading(true);
    setError(undefined);
    try {
      const [emps, inv, letters, tmpls] = await Promise.all([
        listHrEmployees(hotelId),
        listHrInvites(hotelId),
        listLetterDrafts(hotelId),
        listAssessmentTemplates(),
      ]);
      setEmployees(emps);
      setInvites(inv);
      setDrafts(letters);
      setTemplates(tmpls);
      if (!selectedEmployeeId && emps[0]) {
        setSelectedEmployeeId(emps[0].id);
      }
      if (!selectedTemplateId && tmpls[0]) {
        setSelectedTemplateId(tmpls[0].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "שגיאה בטעינה");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [hotelId]);

  useEffect(() => {
    if (!selectedEmployeeId) {
      setEmployeeAssessments([]);
      return;
    }
    let cancelled = false;
    void listEmployeeAssessments(selectedEmployeeId)
      .then((rows) => {
        if (!cancelled) setEmployeeAssessments(rows);
      })
      .catch(() => {
        if (!cancelled) setEmployeeAssessments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedEmployeeId]);

  async function onInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    try {
      const created = await createHrInvite({
        hotelId,
        email,
        displayNameHint,
        roleHint,
      });
      setLastToken(created.token);
      setEmail("");
      setDisplayNameHint("");
      await reload();
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "יצירת הזמנה נכשלה",
      );
    }
  }

  async function onLetter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    try {
      await createLetterDraft({
        kind: "formal_letter",
        subject: letterSubject,
        recipientLabel: letterRecipient,
        hotelId,
        ...(letterNotes.trim() ? { contextNotes: letterNotes.trim() } : {}),
      });
      setLetterSubject("");
      setLetterRecipient("");
      setLetterNotes("");
      await reload();
    } catch (draftError) {
      setError(
        draftError instanceof Error ? draftError.message : "יצירת טיוטה נכשלה",
      );
    }
  }

  if (loading) return <p>טוען משאבי אנוש…</p>;

  return (
    <section className="hr-panel">
      <h2>משאבי אנוש · הרשמה ותכתובת</h2>
      {error ? <p className="error">{error}</p> : null}

      <form className="stack" onSubmit={(e) => void onInvite(e)}>
        <h3>הזמנת עובד חדש</h3>
        <TextField
          label="אימייל"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextField
          label="שם לתצוגה"
          value={displayNameHint}
          onChange={(e) => setDisplayNameHint(e.target.value)}
          required
        />
        <TextField
          label="תפקיד"
          value={roleHint}
          onChange={(e) => setRoleHint(e.target.value)}
          required
        />
        <Button type="submit">צור הזמנה</Button>
      </form>

      {lastToken ? (
        <p className="hint">
          קישור הרשמה (להעברה ידנית):{" "}
          <code>
            {window.location.origin}
            {window.location.pathname}?invite={lastToken}
          </code>
        </p>
      ) : null}

      <h3>הזמנות אחרונות</h3>
      <ul>
        {invites.map((invite) => (
          <li key={invite.id}>
            {invite.displayNameHint} · {invite.email} ·{" "}
            {invite.consumedAt ? "נוצלה" : `עד ${invite.expiresAt.slice(0, 10)}`}
          </li>
        ))}
      </ul>

      <h3>עובדים</h3>
      <ul>
        {employees.map((employee) => (
          <li key={employee.id}>
            {employee.employeeCode ?? "—"} · {employee.displayName} ·{" "}
            {employee.roleLabel} · {employee.status}
          </li>
        ))}
      </ul>

      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (!selectedEmployeeId || !selectedTemplateId) return;
          void assignAssessment(selectedEmployeeId, selectedTemplateId)
            .then(() => listEmployeeAssessments(selectedEmployeeId))
            .then(setEmployeeAssessments)
            .catch((assignError: unknown) => {
              setError(
                assignError instanceof Error
                  ? assignError.message
                  : "הקצאת מבחן נכשלה",
              );
            });
        }}
      >
        <h3>הקצאת מבחן יכולת</h3>
        <label>
          עובד
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
          >
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          תבנית
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
          >
            {templates.map((tmpl) => (
              <option key={tmpl.id} value={tmpl.id}>
                {tmpl.titleHe} ({tmpl.questionCount} שאלות)
              </option>
            ))}
          </select>
        </label>
        <Button type="submit">הקצה מבחן</Button>
      </form>
      <ul>
        {employeeAssessments.map((row) => (
          <li key={row.id}>
            {row.titleHe ?? row.id} · {row.status}
          </li>
        ))}
      </ul>

      <form className="stack" onSubmit={(e) => void onLetter(e)}>
        <h3>טיוטת מכתב רשמי (Correspondence)</h3>
        <TextField
          label="נושא"
          value={letterSubject}
          onChange={(e) => setLetterSubject(e.target.value)}
          required
        />
        <TextField
          label="נמען"
          value={letterRecipient}
          onChange={(e) => setLetterRecipient(e.target.value)}
          required
        />
        <TextField
          label="הערות הקשר"
          value={letterNotes}
          onChange={(e) => setLetterNotes(e.target.value)}
        />
        <Button type="submit">צור טיוטה</Button>
      </form>

      <ul>
        {drafts.map((draft) => (
          <li key={draft.id}>
            <strong>{draft.subject}</strong> → {draft.recipientLabel}
            <pre className="draft-body">{draft.body}</pre>
          </li>
        ))}
      </ul>

      <style>{`
        .hr-panel .stack{display:grid;gap:.75rem;max-width:28rem;margin-block:1rem}
        .hr-panel .hint{background:rgb(16 36 31 / 6%);padding:.75rem;border-radius:8px;word-break:break-all}
        .hr-panel .draft-body{white-space:pre-wrap;font:inherit;background:rgb(255 250 242);padding:.75rem;border-radius:8px}
        .hr-panel .error{color:#8b1e1e}
      `}</style>
    </section>
  );
}
