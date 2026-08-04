import { useEffect, useState, type FormEvent } from "react";
import { Button, TextField } from "@hotelos/ui";
import {
  fetchHrEmployee,
  listHrEmployees,
  listHotels,
  registerHrDocumentFlag,
  type HrDocumentDto,
  type StoredUser,
} from "@hotelos/web-client";

const DOC_TYPES = [
  {
    id: "id_card" as const,
    label: "תעודת זהות / דרכון",
    hint: "צילום ברור של שני הצדדים",
  },
  {
    id: "contract" as const,
    label: "חוזה העסקה",
    hint: "הגרסה החתומה האחרונה",
  },
  {
    id: "criminal_record_clearance" as const,
    label: "תעודת יושר",
    hint: "יעבור לאישור HR ייעודי",
  },
  {
    id: "certification" as const,
    label: "הסמכה / רישיון",
    hint: "למשל מזון, בטיחות, נהיגה",
  },
];

export type DocsPanelProps = {
  readonly user: StoredUser;
};

export function DocsPanel({ user }: DocsPanelProps) {
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<readonly HrDocumentDto[]>([]);
  const [docType, setDocType] =
    useState<(typeof DOC_TYPES)[number]["id"]>("id_card");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();

  async function reload(targetEmployeeId: string) {
    const detail = await fetchHrEmployee(targetEmployeeId);
    setDocuments(detail.documents);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(undefined);
      try {
        const hotels = user.hotelId
          ? [{ id: user.hotelId }]
          : await listHotels();
        const hotelId = hotels[0]?.id;
        if (!hotelId) {
          throw new Error("לא נמצא מלון לחשבון העובד");
        }
        const employees = await listHrEmployees(hotelId);
        const mine =
          employees.find((row) => row.userId === user.id) ?? employees[0];
        if (!mine) {
          throw new Error("לא נמצא כרטיס עובד — פנו למנהל HR");
        }
        if (cancelled) return;
        setEmployeeId(mine.id);
        await reload(mine.id);
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "טעינה נכשלה",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user.id, user.hotelId]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!employeeId) return;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const fileInput = (
        event.currentTarget.elements.namedItem("docFile") as HTMLInputElement
      )?.files?.[0];
      let contentHash: string | undefined;
      if (fileInput) {
        const buffer = await fileInput.arrayBuffer();
        const digest = await crypto.subtle.digest("SHA-256", buffer);
        contentHash = [...new Uint8Array(digest)]
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("");
      }
      await registerHrDocumentFlag(employeeId, {
        docType,
        ...(contentHash !== undefined ? { contentHash } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      await reload(employeeId);
      setNotes("");
      setNotice(
        contentHash
          ? "המסמך נרשם לבדיקת HR עם SHA-256 של הקובץ. בינארי לא נשמר ב־Blob למסמכי HR רגישים (מדיניות hash-only) — הקובץ נשאר אצלכם עד אישור HR."
          : "המסמך נרשם לבדיקת HR כדגל מטא־דאטה (בלי קובץ).",
      );
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error ? submitError.message : "שמירה נכשלה",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="hint">טוען מסמכים…</p>;

  return (
    <section className="docs" aria-labelledby="docs-title">
      <header>
        <h2 id="docs-title">מסמכי עובד</h2>
        <p>
          הסוכן מנחה מה להעלות — אתם בוחרים סוג, מצרפים קובץ, והמערכת שולחת
          לבדיקת HR בלי ניירת במשרד.
        </p>
      </header>

      <ol className="docs__checklist">
        {DOC_TYPES.map((item) => {
          const done = documents.some(
            (doc) =>
              doc.docType === item.id &&
              (doc.status === "approved" || doc.status === "pending_review"),
          );
          return (
            <li key={item.id} className={done ? "docs__item--done" : undefined}>
              <strong>{item.label}</strong>
              <span>{item.hint}</span>
              <em>{done ? "נרשם" : "חסר"}</em>
            </li>
          );
        })}
      </ol>

      <form className="docs__form" onSubmit={(event) => void onSubmit(event)}>
        <label className="docs__select">
          <span>סוג מסמך</span>
          <select
            value={docType}
            onChange={(event) =>
              setDocType(event.target.value as (typeof DOC_TYPES)[number]["id"])
            }
          >
            {DOC_TYPES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="docs__file">
          <span>קובץ (אופציונלי) — מחושב hash בלבד, לא מועלה לשרת</span>
          <input name="docFile" type="file" accept="image/*,.pdf" />
        </label>
        <TextField
          label="הערה ל־HR"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
        <Button type="submit" disabled={busy || !employeeId}>
          {busy ? "שולח…" : "שלח לבדיקה"}
        </Button>
      </form>

      {notice ? (
        <p className="state state--ok" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="state state--err" role="alert">
          {error}
        </p>
      ) : null}

      <style>{`
        .docs { display:grid; gap:var(--space-4); }
        .docs header p { margin:var(--space-2) 0 0; color:var(--color-ink-soft); }
        .docs__checklist { list-style:none; margin:0; padding:0; display:grid; gap:var(--space-2); }
        .docs__checklist li { display:grid; grid-template-columns:1fr auto; gap:.2rem var(--space-3); padding:var(--space-3); border:1px solid var(--color-line); border-radius:var(--radius-sm); }
        .docs__checklist li span { grid-column:1; color:var(--color-ink-soft); font-size:var(--text-small); }
        .docs__checklist li em { grid-column:2; grid-row:1 / span 2; align-self:center; font-style:normal; font-weight:700; color:var(--color-ink-soft); }
        .docs__item--done em { color:var(--color-sea-deep); }
        .docs__form { display:grid; gap:var(--space-3); }
        .docs__select, .docs__file { display:grid; gap:var(--space-2); font-weight:600; font-size:var(--text-small); color:var(--color-ink-soft); }
        .docs__select select, .docs__file input { font:inherit; }
        .state--ok { color:var(--color-sea-deep); }
        .state--err { color:var(--color-danger); }
        .hint { color:var(--color-ink-soft); }
      `}</style>
    </section>
  );
}
