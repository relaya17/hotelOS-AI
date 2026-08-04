import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@hotelos/ui";
import {
  fetchAssessmentDetail,
  listEmployeeAssessments,
  listHrEmployees,
  submitAssessment,
  type AssessmentDetailDto,
  type StoredUser,
} from "@hotelos/web-client";

type AssignmentRow = {
  readonly id: string;
  readonly templateId: string;
  readonly status: string;
  readonly titleHe?: string;
  readonly createdAt: string;
};

export function AssessmentsPanel({ user }: { readonly user: StoredUser }) {
  const [assignments, setAssignments] = useState<readonly AssignmentRow[]>([]);
  const [employeeId, setEmployeeId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [active, setActive] = useState<AssessmentDetailDto | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<
    { readonly score: number; readonly passed: boolean } | undefined
  >();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(undefined);
      try {
        const employees = await listHrEmployees(user.hotelId);
        const mine = employees.find((employee) => employee.userId === user.id);
        if (!mine) {
          if (!cancelled) {
            setEmployeeId(undefined);
            setAssignments([]);
            setError(
              "לא נמצא פרופיל עובד מקושר לחשבון זה. פנו ל־HR לקישור user↔employee.",
            );
          }
          return;
        }
        const list = await listEmployeeAssessments(mine.id);
        if (!cancelled) {
          setEmployeeId(mine.id);
          setAssignments(list);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "טעינה נכשלה",
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
  }, [user.id, user.hotelId]);

  async function openAssignment(assignmentId: string) {
    setError(undefined);
    setResult(undefined);
    setAnswers({});
    try {
      const detail = await fetchAssessmentDetail(assignmentId);
      setActive(detail);
    } catch (openError) {
      setError(
        openError instanceof Error ? openError.message : "פתיחת מבחן נכשלה",
      );
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!active) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const outcome = await submitAssessment(active.id, answers);
      setResult(outcome);
      if (employeeId) {
        setAssignments(await listEmployeeAssessments(employeeId));
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "שליחה נכשלה",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p>טוען מבחנים…</p>;

  return (
    <section className="assess">
      <h2>מבחנים והכשרות</h2>
      <p className="muted">מבחנים שהוקצו לך במערכת HR.</p>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {active ? (
        <form className="assess__form" onSubmit={(e) => void onSubmit(e)}>
          <h3>{active.titleHe ?? "מבחן"}</h3>
          <p className="muted">ציון עובר: {active.passingScore}</p>
          {active.questions.map((question) => (
            <fieldset key={question.id} className="assess__q">
              <legend>{question.promptHe}</legend>
              {question.options.map((option) => (
                <label key={option.id} className="assess__opt">
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
          <div className="assess__actions">
            <Button type="submit" disabled={submitting}>
              שלח תשובות
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setActive(null);
                setResult(undefined);
              }}
            >
              חזרה לרשימה
            </Button>
          </div>
          {result ? (
            <p role="status">
              ציון: {result.score}
              {result.passed ? " · עברת" : " · לא עברת"}
            </p>
          ) : null}
        </form>
      ) : assignments.length === 0 ? (
        <p className="muted">אין מבחנים ממתינים.</p>
      ) : (
        <ul className="assess__list">
          {assignments.map((row) => (
            <li key={row.id}>
              <strong>{row.titleHe ?? row.templateId}</strong> · {row.status}
              {row.status !== "submitted" && row.status !== "passed" ? (
                <Button
                  type="button"
                  onClick={() => void openAssignment(row.id)}
                >
                  פתח מבחן
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <style>{`
        .assess{display:grid;gap:1rem;max-width:40rem}
        .assess__list{list-style:none;padding:0;display:grid;gap:.75rem}
        .assess__list li{display:flex;flex-wrap:wrap;gap:.75rem;align-items:center;border:1px solid var(--color-line-strong);border-radius:8px;padding:.75rem}
        .assess__form{display:grid;gap:1rem}
        .assess__q{border:1px solid var(--color-line-strong);border-radius:8px;padding:.75rem;display:grid;gap:.4rem}
        .assess__opt{display:flex;gap:.5rem;align-items:flex-start}
        .assess__actions{display:flex;flex-wrap:wrap;gap:.5rem}
        .muted{opacity:.75}
        .error{color:#8b1e1e}
      `}</style>
    </section>
  );
}
