import { useEffect, useState } from "react";
import { Button } from "@hotelos/ui";
import {
  listRooms,
  suggestAutonomyDirtyRooms,
  updateRoomStatus,
  type RoomDto,
} from "@hotelos/web-client";

export type HousekeepingPanelProps = {
  readonly hotelId: string;
};

const statusLabel: Record<RoomDto["status"], string> = {
  vacant: "פנוי/נקי",
  occupied: "תפוס",
  dirty: "ממתין לניקיון",
  maintenance: "תחזוקה",
};

export function HousekeepingPanel({ hotelId }: HousekeepingPanelProps) {
  const [rooms, setRooms] = useState<readonly RoomDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [suggesting, setSuggesting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  async function reload() {
    setLoading(true);
    setError(undefined);
    try {
      const data = await listRooms(hotelId);
      setRooms(data);
      setSelected((prev) => {
        const dirtyIds = new Set(
          data.filter((r) => r.status === "dirty").map((r) => r.id),
        );
        if (prev.size === 0) return dirtyIds;
        return new Set([...prev].filter((id) => dirtyIds.has(id)));
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "שגיאה בטעינה");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [hotelId]);

  const dirtyRooms = rooms.filter((room) => room.status === "dirty");

  function toggleRoom(roomId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  }

  async function onSuggest() {
    const roomIds = dirtyRooms
      .filter((room) => selected.has(room.id))
      .map((room) => room.id);
    if (roomIds.length === 0) {
      setError("בחרו לפחות חדר מלוכלך אחד");
      return;
    }
    setSuggesting(true);
    setError(undefined);
    try {
      const result = await suggestAutonomyDirtyRooms({ hotelId, roomIds });
      setNotice(
        `Suggest נשלח לאישורי AI: ${result.dirtyRoomCount} חדרים. אשרו → Act ייפתח משימות ניקיון.`,
      );
    } catch (suggestError) {
      setError(
        suggestError instanceof Error
          ? suggestError.message
          : "הצעת שיבוץ ניקיון נכשלה",
      );
    } finally {
      setSuggesting(false);
    }
  }

  async function onMarkVacant(roomId: string) {
    try {
      await updateRoomStatus(hotelId, roomId, "vacant");
      await reload();
    } catch {
      setError("עדכון סטטוס חדר נכשל");
    }
  }

  return (
    <div className="panel">
      {loading ? <p className="state">טוען…</p> : null}
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
        <h2>משק בית · חדרים לניקיון</h2>
        <p className="hint">
          Suggest→Approve→Act: הצעת שיבוץ ניקיון לתיבת אישורי AI. אחרי אישור
          נפתחות משימות במחלקה — סטטוס החדר נשאר dirty עד סימון ידני אחרי ניקיון.
        </p>

        {dirtyRooms.length === 0 ? (
          <p className="state">אין חדרים במצב dirty כרגע.</p>
        ) : (
          <ul className="list">
            {dirtyRooms.map((room) => (
              <li key={room.id} className="row">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={selected.has(room.id)}
                    onChange={() => toggleRoom(room.id)}
                  />
                  <span>
                    <strong>חדר {room.number}</strong>
                    <span className="meta">
                      קומה {room.floor} · {room.roomType} ·{" "}
                      {statusLabel[room.status]}
                    </span>
                  </span>
                </label>
                <button
                  type="button"
                  className="mini-btn"
                  onClick={() => void onMarkVacant(room.id)}
                >
                  סמן נקי
                </button>
              </li>
            ))}
          </ul>
        )}

        <Button
          type="button"
          disabled={suggesting || dirtyRooms.length === 0}
          onClick={() => void onSuggest()}
        >
          {suggesting
            ? "שולח הצעה…"
            : `הצע שיבוץ ניקיון (${[...selected].length})`}
        </Button>
      </section>

      <section className="card">
        <h2>כל החדרים</h2>
        <ul className="list list--compact">
          {rooms.map((room) => (
            <li key={room.id}>
              חדר {room.number} · {statusLabel[room.status]}
            </li>
          ))}
        </ul>
      </section>

      <style>{`
        .panel { display:grid; gap:var(--space-4); }
        .card { background:rgb(255 250 242 / 90%); border:1px solid rgb(16 36 31 / 10%); border-radius:calc(var(--radius-md) + .1rem); box-shadow:var(--shadow-soft); padding:clamp(1.2rem,2.5vw,1.8rem); display:grid; gap:var(--space-3); }
        .card h2 { margin:0; font-size:var(--text-title); }
        .hint { margin:0; color:var(--color-ink-soft); font-size:var(--text-small); }
        .list { list-style:none; margin:0; padding:0; display:grid; gap:var(--space-2); }
        .list--compact li { padding:.35rem 0; color:var(--color-ink-soft); font-size:var(--text-small); }
        .row { display:flex; justify-content:space-between; gap:var(--space-3); align-items:center; padding:var(--space-3); border:1px solid rgb(16 36 31 / 10%); border-radius:var(--radius-sm); background:var(--color-paper-elevated); }
        .check { display:flex; gap:.65rem; align-items:flex-start; }
        .check strong { display:block; }
        .meta { display:block; color:var(--color-ink-soft); font-size:var(--text-small); margin-top:.15rem; }
        .mini-btn { font:inherit; font-size:var(--text-small); border:1px solid rgb(16 36 31 / 18%); background:transparent; border-radius:var(--radius-sm); padding:.3rem .6rem; cursor:pointer; font-weight:600; }
        .state { margin:0; color:var(--color-ink-soft); }
        .state--error { color:var(--color-danger); }
        .state--ok { color:#0f6a5c; background:rgb(15 106 92 / 10%); padding:.75rem 1rem; border-radius:var(--radius-sm); }
      `}</style>
    </div>
  );
}
