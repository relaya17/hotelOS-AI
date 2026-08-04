import { useMemo, useState } from "react";
import type {
  HotelTwinDto,
  TwinEquipmentNodeDto,
} from "@hotelos/web-client";

export type TwinVisualProps = {
  readonly twin: HotelTwinDto;
  readonly hotelName?: string;
  readonly actionBusy?: boolean;
  readonly actionNotice?: string;
  readonly actionError?: string;
  readonly onSuggestClean?: (room: {
    readonly roomNumber: string;
    readonly roomId: string;
  }) => void;
  readonly onSuggestMaintenance?: (room: {
    readonly roomNumber: string;
    readonly roomId?: string;
  }) => void;
};

type RoomStatus = string;

const STATUS_LABEL: Record<string, string> = {
  vacant: "פנוי",
  occupied: "תפוס",
  dirty: "ממתין לניקיון",
  maintenance: "תחזוקה",
  unknown: "לא ידוע",
};

function deriveFloor(roomNumber: string, floor?: string): string {
  if (floor && floor.trim() !== "") return floor.trim();
  const match = /^(\d+)/.exec(roomNumber);
  if (!match) return "?";
  const n = Number(match[1]);
  if (!Number.isFinite(n) || n < 100) return String(n);
  return String(Math.floor(n / 100));
}

function statusTone(status: RoomStatus): string {
  switch (status) {
    case "vacant":
      return "ok";
    case "occupied":
      return "busy";
    case "dirty":
      return "warn";
    case "maintenance":
      return "crit";
    default:
      return "unknown";
  }
}

function roomHasAlert(
  roomNumber: string,
  equipment: readonly TwinEquipmentNodeDto[],
  overlays: HotelTwinDto["overlays"],
): boolean {
  const roomHit = equipment.some(
    (asset) =>
      asset.health !== "ok" &&
      (asset.locationHe.includes(roomNumber) ||
        asset.nameHe.includes(roomNumber)),
  );
  if (roomHit) return true;
  const incidentHit = (overlays?.openIncidents.topItems ?? []).some((item) =>
    item.title.includes(roomNumber),
  );
  return incidentHit;
}

/**
 * Stage-A Twin Visual: luxurious 2.5D hotel building from live Twin rooms.
 * Click a room to open a live status panel (not a full 3D engine).
 */
export function TwinVisual({
  twin,
  hotelName,
  actionBusy = false,
  actionNotice,
  actionError,
  onSuggestClean,
  onSuggestMaintenance,
}: TwinVisualProps) {
  const [selectedRoom, setSelectedRoom] = useState<string | undefined>();

  const floors = useMemo(() => {
    const map = new Map<
      string,
      {
        floor: string;
        rooms: HotelTwinDto["rooms"];
      }
    >();
    for (const room of twin.rooms) {
      const floor = deriveFloor(room.roomNumber, room.floor);
      const bucket = map.get(floor) ?? { floor, rooms: [] };
      bucket.rooms = [...bucket.rooms, room];
      map.set(floor, bucket);
    }
    return [...map.values()].sort((a, b) =>
      b.floor.localeCompare(a.floor, undefined, { numeric: true }),
    );
  }, [twin.rooms]);

  const selected = twin.rooms.find((room) => room.roomNumber === selectedRoom);
  const selectedRoomId = selected?.roomId;
  const relatedEquipment = (twin.equipment ?? []).filter(
    (asset) =>
      selectedRoom !== undefined &&
      (asset.locationHe.includes(selectedRoom) ||
        asset.nameHe.includes(selectedRoom) ||
        (selected?.floor !== undefined &&
          asset.locationHe.includes(selected.floor))),
  );
  const relatedIncidents = (twin.overlays?.openIncidents.topItems ?? []).filter(
    (item) =>
      selectedRoom !== undefined && item.title.includes(selectedRoom),
  );
  const relatedAlerts = (twin.overlays?.predictiveAlerts.topItems ?? []).filter(
    (item) =>
      selectedRoom !== undefined &&
      (item.assetCode?.includes(selectedRoom) ||
        item.title.includes(selectedRoom) ||
        relatedEquipment.some((asset) => asset.assetId === item.assetId)),
  );

  const counts = useMemo(() => {
    const base = { vacant: 0, occupied: 0, dirty: 0, maintenance: 0, other: 0 };
    for (const room of twin.rooms) {
      if (room.status in base) {
        base[room.status as keyof typeof base] += 1;
      } else {
        base.other += 1;
      }
    }
    return base;
  }, [twin.rooms]);

  return (
    <section className="twin-visual" aria-label="הדמיית Digital Twin חיה">
      <header className="twin-visual__head">
        <div>
          <p className="twin-visual__eyebrow">Twin Visual · 2.5D</p>
          <h3 className="twin-visual__title">
            {hotelName ?? "מלון חי"} · {twin.rooms.length} חדרים
          </h3>
          <p className="twin-visual__lead">
            מבנה לפי מספר החדרים האמיתי. לחיצה על חדר פותחת מצב חי — לא מחליף
            PMS.
          </p>
        </div>
        <ul className="twin-visual__legend" aria-label="מקרא סטטוסים">
          <li data-tone="ok">פנוי ({counts.vacant})</li>
          <li data-tone="busy">תפוס ({counts.occupied})</li>
          <li data-tone="warn">ניקיון ({counts.dirty})</li>
          <li data-tone="crit">תחזוקה ({counts.maintenance})</li>
        </ul>
      </header>

      <div className="twin-visual__stage">
        <div className="twin-visual__building" role="list">
          <div className="twin-visual__crown" aria-hidden="true">
            <span>HotelOS</span>
          </div>
          {floors.map((floor) => (
            <div key={floor.floor} className="twin-visual__floor" role="listitem">
              <div className="twin-visual__floor-label">קומה {floor.floor}</div>
              <div className="twin-visual__rooms">
                {floor.rooms.map((room) => {
                  const tone = statusTone(room.status);
                  const alert = roomHasAlert(
                    room.roomNumber,
                    twin.equipment ?? [],
                    twin.overlays,
                  );
                  const selectedClass =
                    selectedRoom === room.roomNumber
                      ? " twin-visual__room--selected"
                      : "";
                  return (
                    <button
                      key={room.roomNumber}
                      type="button"
                      className={`twin-visual__room twin-visual__room--${tone}${selectedClass}${alert ? " twin-visual__room--alert" : ""}`}
                      aria-pressed={selectedRoom === room.roomNumber}
                      aria-label={`חדר ${room.roomNumber}, ${STATUS_LABEL[room.status] ?? room.status}`}
                      onClick={() =>
                        setSelectedRoom((prev) =>
                          prev === room.roomNumber ? undefined : room.roomNumber,
                        )
                      }
                    >
                      <span className="twin-visual__room-num">
                        {room.roomNumber}
                      </span>
                      <span className="twin-visual__room-status">
                        {STATUS_LABEL[room.status] ?? room.status}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="twin-visual__lobby" aria-hidden="true">
            לובי · קבלה
          </div>
        </div>

        <aside
          className="twin-visual__panel"
          aria-live="polite"
          aria-label="מצב חדר חי"
        >
          {!selected ? (
            <p className="twin-visual__empty">
              בחרו חדר במבנה כדי לראות מצב חי, ציוד קשור ותקלות.
            </p>
          ) : (
            <>
              <h4>חדר {selected.roomNumber}</h4>
              <p>
                <strong>{STATUS_LABEL[selected.status] ?? selected.status}</strong>
                {" · "}
                מקור: {selected.source}
                {selected.floor ? ` · קומה ${selected.floor}` : ""}
              </p>
              <p className="twin-visual__meta">
                עודכן: {twin.generatedAt.slice(0, 19)}
              </p>

              <h5>ציוד קשור</h5>
              {relatedEquipment.length === 0 ? (
                <p className="twin-visual__meta">אין ציוד מקושר לחדר זה.</p>
              ) : (
                <ul>
                  {relatedEquipment.map((asset) => (
                    <li key={asset.assetId}>
                      {asset.assetCode} · {asset.nameHe} · {asset.health}
                    </li>
                  ))}
                </ul>
              )}

              <h5>תקלות / חיזוי</h5>
              {relatedIncidents.length === 0 && relatedAlerts.length === 0 ? (
                <p className="twin-visual__meta">אין התראות פתוחות לחדר.</p>
              ) : (
                <ul>
                  {relatedIncidents.map((item) => (
                    <li key={item.id}>{item.title}</li>
                  ))}
                  {relatedAlerts.map((item) => (
                    <li key={item.id}>
                      {item.title}
                      {item.riskScore !== undefined
                        ? ` · סיכון ${item.riskScore}`
                        : ""}
                    </li>
                  ))}
                </ul>
              )}

              {(onSuggestClean !== undefined ||
                onSuggestMaintenance !== undefined) && (
                <>
                  <h5>Suggest → Approve → Act</h5>
                  <p className="twin-visual__meta">
                    ההצעה נכנסת לתיבת אישורי AI — אין כתיבה ל־PMS בלי אישור
                    אנושי.
                  </p>
                  <div className="twin-visual__actions">
                    {onSuggestClean !== undefined &&
                    selected.status === "dirty" &&
                    selectedRoomId !== undefined ? (
                      <button
                        type="button"
                        className="twin-visual__action"
                        disabled={actionBusy}
                        onClick={() =>
                          onSuggestClean({
                            roomNumber: selected.roomNumber,
                            roomId: selectedRoomId,
                          })
                        }
                      >
                        {actionBusy ? "שולח…" : "הצע ניקיון לחדר"}
                      </button>
                    ) : null}
                    {onSuggestMaintenance !== undefined ? (
                      <button
                        type="button"
                        className="twin-visual__action twin-visual__action--warn"
                        disabled={actionBusy}
                        onClick={() =>
                          onSuggestMaintenance({
                            roomNumber: selected.roomNumber,
                            ...(selectedRoomId !== undefined
                              ? { roomId: selectedRoomId }
                              : {}),
                          })
                        }
                      >
                        {actionBusy ? "שולח…" : "הצע משימת תחזוקה"}
                      </button>
                    ) : null}
                  </div>
                  {actionNotice ? (
                    <p className="twin-visual__notice">{actionNotice}</p>
                  ) : null}
                  {actionError ? (
                    <p className="twin-visual__action-error">{actionError}</p>
                  ) : null}
                </>
              )}
            </>
          )}
        </aside>
      </div>

      <style>{`
        .twin-visual {
          --tv-ink: #0b0f14;
          --tv-ink-2: #141b24;
          --tv-mist: #e8e0d4;
          --tv-brass: #d4b07a;
          --tv-jade: #6eb5a8;
          --tv-warn: #c9853b;
          --tv-crit: #c45b5b;
          margin: 1rem 0 1.25rem;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid rgb(212 176 122 / 28%);
          background:
            radial-gradient(ellipse 80% 50% at 20% 0%, rgb(110 181 168 / 14%), transparent 55%),
            linear-gradient(160deg, var(--tv-ink), var(--tv-ink-2) 55%, #0a0c10);
          color: var(--tv-mist);
          padding: 1rem 1rem 1.15rem;
        }
        .twin-visual__head {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .twin-visual__eyebrow {
          margin: 0 0 .25rem;
          color: var(--tv-jade);
          letter-spacing: .08em;
          text-transform: uppercase;
          font-size: .72rem;
        }
        .twin-visual__title {
          margin: 0 0 .35rem;
          font-size: clamp(1.15rem, 2.4vw, 1.45rem);
          color: var(--tv-brass);
          font-weight: 700;
        }
        .twin-visual__lead {
          margin: 0;
          max-width: 36rem;
          opacity: .78;
          font-size: .92rem;
        }
        .twin-visual__legend {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-wrap: wrap;
          gap: .45rem;
          align-content: start;
        }
        .twin-visual__legend li {
          font-size: .78rem;
          padding: .28rem .55rem;
          border-radius: 999px;
          border: 1px solid rgb(232 224 212 / 18%);
        }
        .twin-visual__legend li[data-tone="ok"] { background: rgb(110 181 168 / 18%); }
        .twin-visual__legend li[data-tone="busy"] { background: rgb(212 176 122 / 18%); }
        .twin-visual__legend li[data-tone="warn"] { background: rgb(201 133 59 / 22%); }
        .twin-visual__legend li[data-tone="crit"] { background: rgb(196 91 91 / 22%); }
        .twin-visual__stage {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(14rem, .9fr);
          gap: 1rem;
          align-items: start;
        }
        @media (max-width: 860px) {
          .twin-visual__stage { grid-template-columns: 1fr; }
        }
        .twin-visual__building {
          perspective: 900px;
          padding: .5rem .25rem 0;
        }
        .twin-visual__crown {
          margin: 0 auto .55rem;
          width: min(100%, 18rem);
          text-align: center;
          padding: .45rem .75rem;
          border-radius: .55rem .55rem 0 0;
          background: linear-gradient(90deg, rgb(212 176 122 / 25%), rgb(110 181 168 / 18%));
          border: 1px solid rgb(212 176 122 / 35%);
          border-bottom: 0;
          color: var(--tv-brass);
          font-weight: 650;
          letter-spacing: .04em;
          transform: rotateX(8deg);
        }
        .twin-visual__floor {
          display: grid;
          grid-template-columns: 4.5rem 1fr;
          gap: .55rem;
          align-items: stretch;
          margin-bottom: .45rem;
          transform: skewX(-4deg);
        }
        .twin-visual__floor-label {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: .78rem;
          color: rgb(232 224 212 / 72%);
          border: 1px solid rgb(232 224 212 / 12%);
          border-radius: .4rem;
          background: rgb(255 255 255 / 3%);
        }
        .twin-visual__rooms {
          display: flex;
          flex-wrap: wrap;
          gap: .4rem;
        }
        .twin-visual__room {
          min-width: 4.6rem;
          padding: .55rem .5rem;
          border-radius: .45rem;
          border: 1px solid rgb(232 224 212 / 16%);
          background: rgb(255 255 255 / 5%);
          color: inherit;
          cursor: pointer;
          text-align: start;
          transform: skewX(4deg);
          transition: transform .18s ease, border-color .18s ease, background .18s ease;
        }
        .twin-visual__room:hover,
        .twin-visual__room:focus-visible {
          transform: skewX(4deg) translateY(-2px);
          outline: 2px solid rgb(212 176 122 / 55%);
          outline-offset: 1px;
        }
        .twin-visual__room--selected {
          border-color: var(--tv-brass);
          box-shadow: 0 0 0 1px rgb(212 176 122 / 45%);
        }
        .twin-visual__room--alert {
          box-shadow: inset 0 0 0 1px rgb(196 91 91 / 55%);
        }
        .twin-visual__room--ok { background: rgb(110 181 168 / 16%); }
        .twin-visual__room--busy { background: rgb(212 176 122 / 16%); }
        .twin-visual__room--warn { background: rgb(201 133 59 / 20%); }
        .twin-visual__room--crit { background: rgb(196 91 91 / 22%); }
        .twin-visual__room--unknown { background: rgb(255 255 255 / 6%); }
        .twin-visual__room-num {
          display: block;
          font-weight: 700;
          color: var(--tv-brass);
          line-height: 1.1;
        }
        .twin-visual__room-status {
          display: block;
          font-size: .72rem;
          opacity: .85;
          margin-top: .2rem;
        }
        .twin-visual__lobby {
          margin-top: .35rem;
          text-align: center;
          padding: .65rem;
          border-radius: 0 0 .7rem .7rem;
          border: 1px solid rgb(212 176 122 / 28%);
          background: linear-gradient(180deg, rgb(212 176 122 / 12%), rgb(0 0 0 / 20%));
          color: var(--tv-brass);
          letter-spacing: .06em;
          font-size: .82rem;
        }
        .twin-visual__panel {
          border: 1px solid rgb(232 224 212 / 14%);
          border-radius: .7rem;
          padding: .85rem .9rem;
          background: rgb(255 255 255 / 4%);
          min-height: 12rem;
        }
        .twin-visual__panel h4 {
          margin: 0 0 .4rem;
          color: var(--tv-brass);
          font-size: 1.05rem;
        }
        .twin-visual__panel h5 {
          margin: .85rem 0 .3rem;
          font-size: .82rem;
          color: var(--tv-jade);
          letter-spacing: .04em;
        }
        .twin-visual__panel p,
        .twin-visual__panel li {
          margin: 0;
          font-size: .9rem;
        }
        .twin-visual__panel ul {
          margin: 0;
          padding-inline-start: 1.1rem;
          display: grid;
          gap: .25rem;
        }
        .twin-visual__meta { opacity: .72; font-size: .82rem !important; }
        .twin-visual__empty {
          margin: 0;
          opacity: .75;
          line-height: 1.45;
        }
        .twin-visual__actions {
          display: flex;
          flex-wrap: wrap;
          gap: .45rem;
          margin-top: .55rem;
        }
        .twin-visual__action {
          border: 1px solid rgb(212 176 122 / 45%);
          background: rgb(212 176 122 / 16%);
          color: var(--tv-mist);
          border-radius: .45rem;
          padding: .45rem .7rem;
          cursor: pointer;
          font-size: .82rem;
          min-height: 2.75rem;
        }
        .twin-visual__action:disabled {
          opacity: .55;
          cursor: not-allowed;
        }
        .twin-visual__action--warn {
          border-color: rgb(201 133 59 / 55%);
          background: rgb(201 133 59 / 18%);
        }
        .twin-visual__notice {
          margin: .55rem 0 0 !important;
          font-size: .82rem !important;
          color: var(--tv-jade);
        }
        .twin-visual__action-error {
          margin: .55rem 0 0 !important;
          font-size: .82rem !important;
          color: var(--tv-crit);
        }
        @media (max-width: 480px) {
          .twin-visual__floor {
            grid-template-columns: 3.25rem 1fr;
            gap: .35rem;
            transform: none;
          }
          .twin-visual__room {
            min-width: 4.4rem;
            min-height: var(--touch-min, 2.75rem);
            padding: .55rem .45rem;
            transform: none;
          }
          .twin-visual__room:hover,
          .twin-visual__room:focus-visible {
            transform: translateY(-2px);
          }
          .twin-visual__actions { flex-direction: column; }
          .twin-visual__action { width: 100%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .twin-visual__room,
          .twin-visual__room:hover,
          .twin-visual__room:focus-visible {
            transition: none;
            transform: none;
          }
        }
      `}</style>
    </section>
  );
}
