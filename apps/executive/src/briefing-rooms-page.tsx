import { useEffect, useState, type FormEvent } from "react";
import { Button, TextField } from "@hotelos/ui";
import {
  createBriefingRoom,
  listAgents,
  listBriefingRooms,
  type AgentDto,
  type BriefingRoomSummaryDto,
} from "@hotelos/web-client";

export type BriefingRoomsPageProps = {
  readonly onOpenRoom: (roomId: string) => void;
};

const purposeLabel: Record<string, string> = {
  finance_committee: "ועדת כספים",
  regional_ops: "תפעול אזורי",
  revenue_review: "סקירת הכנסות",
  custom: "מותאם",
};

const statusLabel: Record<BriefingRoomSummaryDto["status"], string> = {
  scheduled: "מתוזמן",
  live: "בשידור",
  ended: "הסתיים",
};

export function BriefingRoomsPage({ onOpenRoom }: BriefingRoomsPageProps) {
  const [rooms, setRooms] = useState<readonly BriefingRoomSummaryDto[]>([]);
  const [agents, setAgents] = useState<readonly AgentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [title, setTitle] = useState("בריפינג מנהלי אזור");
  const [purpose, setPurpose] = useState("regional_ops");
  const [creating, setCreating] = useState(false);

  async function reload() {
    const [roomData, agentData] = await Promise.all([
      listBriefingRooms(),
      listAgents(),
    ]);
    setRooms(roomData);
    setAgents(agentData);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(undefined);
      try {
        await reload();
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
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(undefined);
    try {
      const room = await createBriefingRoom({
        title,
        purpose,
        participants: [
          { displayName: "מנהל מלון א׳", roleLabel: "מנהל מלון" },
          { displayName: "מנהל מלון ב׳", roleLabel: "מנהל מלון" },
        ],
      });
      await reload();
      onOpenRoom(room.id);
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "יצירה נכשלה",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="brief">
      <header className="brief__header">
        <div>
          <p className="eyebrow">Briefing Rooms · רמת רשת / אזור</p>
          <h1>חדרי בריפינג</h1>
          <p className="sub">
            מנהל אזור נפגש עם צוותים ומנהלים — פגישה פנימית (HotelOS Meet) עם
            אפשרות לשתף סוכנים חכמים שכבר קיימים במערכת.
          </p>
        </div>
      </header>

      <section className="agents-strip" aria-label="סוכנים זמינים במערכת">
        <h2>קטלוג סוכנים ({agents.length})</h2>
        <ul>
          {agents.slice(0, 8).map((agent) => (
            <li key={agent.id}>
              <strong>{agent.nameHe}</strong>
              <span>{agent.domain}</span>
            </li>
          ))}
          {agents.length > 8 ? (
            <li className="more">+{agents.length - 8} נוספים</li>
          ) : null}
        </ul>
      </section>

      <div className="brief__cols">
        <section className="card">
          <h2>חדרים פעילים</h2>
          {loading ? <p className="state">טוען…</p> : null}
          {error !== undefined ? (
            <p className="state state--error" role="alert">
              {error}
            </p>
          ) : null}
          <ul className="rooms">
            {rooms.map((room) => (
              <li key={room.id}>
                <div>
                  <h3>{room.title}</h3>
                  <p>
                    {purposeLabel[room.purpose] ?? room.purpose} ·{" "}
                    {statusLabel[room.status]}
                  </p>
                </div>
                <Button type="button" onClick={() => onOpenRoom(room.id)}>
                  היכנס לפגישה
                </Button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2>פתח חדר חדש</h2>
          <form className="form" onSubmit={onCreate}>
            <TextField
              label="כותרת החדר"
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
            <label className="select-field">
              <span>מטרת הוועדה</span>
              <select
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
              >
                <option value="finance_committee">ועדת כספים</option>
                <option value="regional_ops">תפעול אזורי</option>
                <option value="revenue_review">סקירת הכנסות</option>
                <option value="custom">מותאם</option>
              </select>
            </label>
            <p className="hint">
              אחרי הכניסה לחדר אפשר לשתף סוכן כספים, הכנסות, אנליטיקה ועוד — בלי
              לצאת מהפגישה.
            </p>
            <Button type="submit" disabled={creating}>
              {creating ? "יוצר…" : "צור והיכנס"}
            </Button>
          </form>
        </section>
      </div>

      <style>{`
        .brief { display:grid; gap:var(--space-5); }
        .brief__header h1 { margin:0; font-size:var(--text-display); }
        .eyebrow { margin:0 0 var(--space-2); letter-spacing:.08em; text-transform:uppercase; font-size:var(--text-small); color:var(--color-sea-deep); font-weight:700; }
        .sub { margin:var(--space-2) 0 0; color:var(--color-ink-soft); max-width:60ch; }
        .agents-strip { background:rgb(255 250 242 / 88%); border:1px solid rgb(16 36 31 / 10%); border-radius:var(--radius-md); padding:var(--space-4); box-shadow:var(--shadow-soft); }
        .agents-strip h2 { margin:0 0 var(--space-3); font-size:1.1rem; }
        .agents-strip ul { list-style:none; margin:0; padding:0; display:flex; flex-wrap:wrap; gap:var(--space-2); }
        .agents-strip li { display:grid; gap:.15rem; padding:.55rem .8rem; border-radius:var(--radius-sm); background:rgb(15 106 92 / 8%); border:1px solid rgb(15 106 92 / 14%); }
        .agents-strip li strong { font-size:var(--text-small); }
        .agents-strip li span { font-size:.75rem; color:var(--color-ink-soft); }
        .agents-strip .more { align-content:center; font-weight:700; color:var(--color-sea-deep); }
        .brief__cols { display:grid; grid-template-columns:1.2fr .8fr; gap:var(--space-4); }
        .card { background:rgb(255 250 242 / 92%); border:1px solid rgb(16 36 31 / 10%); border-radius:var(--radius-md); padding:clamp(1.2rem,2.5vw,1.8rem); box-shadow:var(--shadow-soft); }
        .card h2 { margin:0 0 var(--space-4); font-size:var(--text-title); }
        .rooms { list-style:none; margin:0; padding:0; display:grid; gap:var(--space-3); }
        .rooms li { display:flex; justify-content:space-between; gap:var(--space-3); align-items:center; padding:var(--space-4); border:1px solid rgb(16 36 31 / 10%); border-radius:var(--radius-sm); background:var(--color-paper-elevated); }
        .rooms h3 { margin:0; font-family:var(--font-display); font-size:1.15rem; }
        .rooms p { margin:var(--space-1) 0 0; color:var(--color-ink-soft); font-size:var(--text-small); }
        .form { display:grid; gap:var(--space-3); }
        .select-field { display:grid; gap:var(--space-2); }
        .select-field span { font-size:var(--text-small); font-weight:600; color:var(--color-ink-soft); }
        .select-field select { font:inherit; border:1px solid rgb(16 36 31 / 18%); border-radius:var(--radius-sm); padding:.85rem .95rem; background:var(--color-paper-elevated); }
        .hint { margin:0; color:var(--color-ink-soft); font-size:var(--text-small); }
        .state { margin:0; color:var(--color-ink-soft); }
        .state--error { color:var(--color-danger); }
        @media (max-width:900px){ .brief__cols{ grid-template-columns:1fr; } }
      `}</style>
    </div>
  );
}
