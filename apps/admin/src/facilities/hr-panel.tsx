import { useEffect, useState, type FormEvent } from "react";
import { Button, TextField } from "@hotelos/ui";
import {
  assignAssessment,
  createHrInvite,
  createLetterDraft,
  fetchAssessmentDetail,
  fetchHrEmployee,
  fetchLetterLegalChecklist,
  listAssessmentTemplates,
  listEmployeeAssessments,
  listHrEmployees,
  listHrInvites,
  listLetterDrafts,
  readStoredUser,
  registerHrDocumentFlag,
  reviewHrDocument,
  submitAssessment,
  updateLetterDraftStatus,
  type AssessmentDetailDto,
  type AssessmentTemplateDto,
  type HrDocumentDto,
  type HrEmployeeDto,
  type HrInviteDto,
  type LegalChecklistDto,
  type LetterDraftDto,
} from "@hotelos/web-client";

export type HrPanelProps = {
  readonly hotelId: string;
};

export function HrPanel({ hotelId }: HrPanelProps) {
  const viewerRoles = readStoredUser()?.roles ?? [];
  const canReviewCriminalRecord = viewerRoles.includes("hr");
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
  const [activeAssessment, setActiveAssessment] =
    useState<AssessmentDetailDto | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [lastScore, setLastScore] = useState<string | undefined>();
  const [documents, setDocuments] = useState<readonly HrDocumentDto[]>([]);
  const [serverAllowsCriminalReview, setServerAllowsCriminalReview] = useState(
    canReviewCriminalRecord,
  );
  const [docType, setDocType] = useState<
    | "criminal_record_clearance"
    | "id_card"
    | "contract"
    | "certification"
    | "other"
  >("criminal_record_clearance");
  const [docHash, setDocHash] = useState("");
  const [docAuthority, setDocAuthority] = useState("");
  const [checklistDraftId, setChecklistDraftId] = useState<string | undefined>();
  const [checklist, setChecklist] = useState<LegalChecklistDto | null>(null);
  const [ackIds, setAckIds] = useState<ReadonlySet<string>>(new Set());
  const [approving, setApproving] = useState(false);

  const mayReviewCriminal =
    canReviewCriminalRecord || serverAllowsCriminalReview;

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
      setDocuments([]);
      return;
    }
    let cancelled = false;
    void Promise.all([
      listEmployeeAssessments(selectedEmployeeId),
      fetchHrEmployee(selectedEmployeeId),
    ])
      .then(([rows, detail]) => {
        if (cancelled) return;
        setEmployeeAssessments(rows);
        setDocuments(detail.documents);
        setServerAllowsCriminalReview(
          detail.viewerCanReviewCriminalRecord ?? false,
        );
      })
      .catch(() => {
        if (cancelled) return;
        setEmployeeAssessments([]);
        setDocuments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedEmployeeId]);

  async function reloadDocuments() {
    if (!selectedEmployeeId) return;
    const detail = await fetchHrEmployee(selectedEmployeeId);
    setDocuments(detail.documents);
    setServerAllowsCriminalReview(
      detail.viewerCanReviewCriminalRecord ?? false,
    );
  }

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

  async function openLegalChecklist(draft: LetterDraftDto) {
    setError(undefined);
    try {
      const data = await fetchLetterLegalChecklist(draft.id);
      setChecklistDraftId(draft.id);
      setChecklist(data);
      setAckIds(new Set(data.autoPassedItemIds));
    } catch (checklistError) {
      setError(
        checklistError instanceof Error
          ? checklistError.message
          : "טעינת צ׳קליסט Legal נכשלה",
      );
    }
  }

  function toggleAck(itemId: string) {
    setAckIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  async function confirmApprove(draftId: string) {
    if (!checklist) return;
    setApproving(true);
    setError(undefined);
    try {
      const acknowledgedItemIds = checklist.applies
        ? checklist.blockingItemIds.filter((id) => ackIds.has(id))
        : [];
      if (
        checklist.applies &&
        acknowledgedItemIds.length < checklist.blockingItemIds.length
      ) {
        setError("יש לסמן את כל פריטי הצ׳קליסט החסרים לפני אישור.");
        return;
      }
      await updateLetterDraftStatus(draftId, "approved", {
        acknowledgedItemIds: [
          ...checklist.autoPassedItemIds,
          ...acknowledgedItemIds,
        ],
      });
      setChecklistDraftId(undefined);
      setChecklist(null);
      setAckIds(new Set());
      await reload();
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "אישור טיוטה נכשל",
      );
    } finally {
      setApproving(false);
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
          if (!selectedEmployeeId) return;
          void registerHrDocumentFlag(selectedEmployeeId, {
            docType,
            ...(docHash.trim() ? { contentHash: docHash.trim() } : {}),
            ...(docAuthority.trim()
              ? { issuingAuthority: docAuthority.trim() }
              : {}),
          })
            .then(() => {
              setDocHash("");
              setDocAuthority("");
              return reloadDocuments();
            })
            .catch((docError: unknown) => {
              setError(
                docError instanceof Error
                  ? docError.message
                  : "רישום מסמך נכשל",
              );
            });
        }}
      >
        <h3>מסמכי עובד (hash בלבד)</h3>
        <p className="hint">
          לפי מדיניות PO — לא נשמר קובץ רגיש במערכת, רק דגל/hash לביקורת.
        </p>
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
          סוג מסמך
          <select
            value={docType}
            onChange={(e) =>
              setDocType(e.target.value as typeof docType)
            }
          >
            <option value="criminal_record_clearance">תעודת יושר</option>
            <option value="id_card">תעודת זהות</option>
            <option value="contract">חוזה</option>
            <option value="certification">הסמכה</option>
            <option value="other">אחר</option>
          </select>
        </label>
        <TextField
          label="Content hash (אופציונלי)"
          value={docHash}
          onChange={(e) => setDocHash(e.target.value)}
        />
        <TextField
          label="רשות מנפיקה"
          value={docAuthority}
          onChange={(e) => setDocAuthority(e.target.value)}
        />
        <Button type="submit">רשום לבדיקה</Button>
      </form>
      {!mayReviewCriminal ? (
        <p className="hint">
          תעודת יושר: סטטוס בלבד. אישור/דחייה ו־hash דורשים תפקיד HR ייעודי.
        </p>
      ) : null}
      <ul>
        {documents.map((doc) => {
          const isCriminal = doc.docType === "criminal_record_clearance";
          const canReviewThis =
            doc.status === "pending_review" &&
            (!isCriminal || mayReviewCriminal);
          return (
            <li key={doc.id}>
              {doc.docType} · {doc.status}
              {doc.contentHash
                ? ` · hash ${doc.contentHash.slice(0, 12)}…`
                : isCriminal && !mayReviewCriminal
                  ? " · hash מוסתר"
                  : ""}
              {canReviewThis ? (
                <span className="doc-actions">
                  <Button
                    type="button"
                    onClick={() =>
                      void reviewHrDocument(doc.id, { status: "approved" })
                        .then(reloadDocuments)
                        .catch((reviewError: unknown) => {
                          setError(
                            reviewError instanceof Error
                              ? reviewError.message
                              : "אישור נכשל",
                          );
                        })
                    }
                  >
                    אשר
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      void reviewHrDocument(doc.id, { status: "rejected" })
                        .then(reloadDocuments)
                        .catch((reviewError: unknown) => {
                          setError(
                            reviewError instanceof Error
                              ? reviewError.message
                              : "דחייה נכשלה",
                          );
                        })
                    }
                  >
                    דחה
                  </Button>
                </span>
              ) : null}
            </li>
          );
        })}
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
            {row.titleHe ?? row.id} · {row.status}{" "}
            {row.status !== "completed" ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  void fetchAssessmentDetail(row.id)
                    .then((detail) => {
                      setActiveAssessment(detail);
                      setAnswers({});
                      setLastScore(undefined);
                    })
                    .catch((loadError: unknown) => {
                      setError(
                        loadError instanceof Error
                          ? loadError.message
                          : "טעינת מבחן נכשלה",
                      );
                    })
                }
              >
                מלא מבחן
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

      {activeAssessment ? (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void submitAssessment(activeAssessment.id, answers)
              .then((result) => {
                setLastScore(
                  `ציון ${result.score} · ${result.passed ? "עבר" : "לא עבר"}`,
                );
                setActiveAssessment(null);
                return listEmployeeAssessments(selectedEmployeeId);
              })
              .then(setEmployeeAssessments)
              .catch((submitError: unknown) => {
                setError(
                  submitError instanceof Error
                    ? submitError.message
                    : "הגשה נכשלה",
                );
              });
          }}
        >
          <h3>{activeAssessment.titleHe ?? "מבחן"}</h3>
          {activeAssessment.questions.map((question) => (
            <fieldset key={question.id}>
              <legend>{question.promptHe}</legend>
              {question.options.map((option) => (
                <label key={option.id} className="option">
                  <input
                    type="radio"
                    name={question.id}
                    value={option.id}
                    checked={answers[question.id] === option.id}
                    onChange={() =>
                      setAnswers((prev) => ({
                        ...prev,
                        [question.id]: option.id,
                      }))
                    }
                    required
                  />
                  {option.labelHe}
                </label>
              ))}
            </fieldset>
          ))}
          <Button type="submit">הגש מבחן</Button>
        </form>
      ) : null}
      {lastScore ? <p className="hint">{lastScore}</p> : null}

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
            <strong>{draft.subject}</strong> → {draft.recipientLabel} ·{" "}
            {draft.status} · {draft.kind}
            <pre className="draft-body">{draft.body}</pre>
            {draft.status === "draft" ? (
              <span className="doc-actions">
                <Button
                  type="button"
                  onClick={() => void openLegalChecklist(draft)}
                >
                  אשר (צ׳קליסט Legal)
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    void updateLetterDraftStatus(draft.id, "discarded")
                      .then(reload)
                      .catch((statusError: unknown) => {
                        setError(
                          statusError instanceof Error
                            ? statusError.message
                            : "ביטול טיוטה נכשל",
                        );
                      })
                  }
                >
                  בטל
                </Button>
              </span>
            ) : null}
            {checklistDraftId === draft.id && checklist ? (
              <div className="legal-gate">
                <p className="legal-gate__title">{checklist.gateHe}</p>
                {!checklist.applies ? (
                  <p className="hint">אין צורך בצ׳קליסט — ניתן לאשר.</p>
                ) : (
                  <ul className="legal-items">
                    {checklist.items.map((item) => {
                      const lockedPass = item.status === "pass";
                      const checked = lockedPass || ackIds.has(item.id);
                      return (
                        <li key={item.id}>
                          <label className="option">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={lockedPass || approving}
                              onChange={() => toggleAck(item.id)}
                            />
                            <span>
                              <strong>{item.labelHe}</strong>
                              <span className={`chip chip--${item.status}`}>
                                {item.status === "pass"
                                  ? "עבר"
                                  : item.status === "fail"
                                    ? "חסר"
                                    : "לאישור"}
                              </span>
                              <br />
                              <span className="muted">{item.detailHe}</span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="doc-actions">
                  <Button
                    type="button"
                    disabled={approving}
                    onClick={() => void confirmApprove(draft.id)}
                  >
                    {approving ? "מאשר…" : "אשר אחרי צ׳קליסט"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setChecklistDraftId(undefined);
                      setChecklist(null);
                      setAckIds(new Set());
                    }}
                  >
                    סגור
                  </Button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <style>{`
        .hr-panel .stack{display:grid;gap:.75rem;max-width:28rem;margin-block:1rem}
        .hr-panel .hint{background:rgb(16 36 31 / 6%);padding:.75rem;border-radius:8px;word-break:break-all}
        .hr-panel .draft-body{white-space:pre-wrap;font:inherit;background:rgb(255 250 242);padding:.75rem;border-radius:8px}
        .hr-panel .error{color:#8b1e1e}
        .hr-panel .option{display:flex;gap:.5rem;align-items:flex-start;margin-block:.25rem}
        .hr-panel fieldset{border:1px solid rgb(16 36 31 / 12%);border-radius:8px;padding:.75rem}
        .hr-panel .doc-actions{display:inline-flex;gap:.35rem;margin-inline-start:.5rem;margin-top:.5rem}
        .hr-panel .legal-gate{margin-top:.75rem;padding:1rem;border:1px dashed rgb(16 36 31 / 22%);border-radius:8px;display:grid;gap:.65rem;max-width:36rem}
        .hr-panel .legal-gate__title{margin:0;font-weight:700}
        .hr-panel .legal-items{list-style:none;padding:0;margin:0;display:grid;gap:.5rem}
        .hr-panel .muted{opacity:.75;font-size:.9rem}
        .hr-panel .chip{display:inline-block;margin-inline-start:.35rem;font-size:.75rem;font-weight:700;padding:.1rem .4rem;border-radius:999px}
        .hr-panel .chip--pass{color:#0f6a5c;background:rgb(15 106 92 / 12%)}
        .hr-panel .chip--fail{color:#9b2c2c;background:rgb(155 44 44 / 12%)}
        .hr-panel .chip--needs_ack{color:#8a5a12;background:rgb(138 90 18 / 12%)}
      `}</style>
    </section>
  );
}
