import { useEffect, useState } from "react";
import { Button } from "@hotelos/ui";
import {
  fetchHotelTwin,
  syncHotelTwinPms,
  type HotelTwinDto,
  type HotelTwinOverlaySummaryDto,
} from "@hotelos/web-client";

export type TwinPanelProps = {
  readonly hotelId: string;
};

function OverlaySection({
  title,
  summary,
  badgeClass,
  renderMeta,
}: {
  readonly title: string;
  readonly summary: HotelTwinOverlaySummaryDto | undefined;
  readonly badgeClass?: string | undefined;
  readonly renderMeta: (
    item: HotelTwinOverlaySummaryDto["topItems"][number],
  ) => string;
}) {
  const count = summary?.count ?? 0;
  const items = summary?.topItems ?? [];

  return (
    <section className="twin-overlay">
      <h3>
        {title}{" "}
        <span className={`badge${badgeClass ? ` ${badgeClass}` : ""}`}>
          {count}
        </span>
      </h3>
      {count === 0 ? <p className="hint">אין פריטים פתוחים.</p> : null}
      {items.length > 0 ? (
        <ul className="twin-overlay__list">
          {items.map((item) => (
            <li key={item.id}>
              <strong>{item.title}</strong>
              <span className="twin-overlay__meta">{renderMeta(item)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function TwinPanel({ hotelId }: TwinPanelProps) {
  const [twin, setTwin] = useState<HotelTwinDto | null>(null);
  const [note, setNote] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true);
    setError(undefined);
    try {
      setTwin(await fetchHotelTwin(hotelId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "שגיאה");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [hotelId]);

  async function onSync() {
    setError(undefined);
    try {
      const result = await syncHotelTwinPms(hotelId);
      setTwin(result.twin);
      setNote(result.sync.noteHe);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "סנכרון נכשל");
    }
  }

  if (loading) return <p>טוען Digital Twin…</p>;

  const reservations = twin?.pms?.reservations ?? [];
  const overlays = twin?.overlays;

  return (
    <section>
      <h2>Digital Twin · מצב חדרים</h2>
      <p className="muted">
        משטח תפעולי (ops) בלבד — מיזוג מצב HotelOS עם מחבר PMS (קריאה בלבד —
        demo / Mews / Opera stub). לא מחליף PMS ולא שייך לפורטל העובדים.
      </p>
      <Button type="button" onClick={() => void onSync()}>
        סנכרון PMS
      </Button>
      {note ? <p className="hint">{note}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {twin ? (
        <>
          <p>
            עודכן: {twin.generatedAt.slice(0, 19)}
            {twin.pms
              ? ` · PMS ${twin.pms.providerId} · הזמנות ${twin.pms.reservationCount}`
              : ""}
            {overlays
              ? ` · שכבות ${overlays.generatedAt.slice(0, 19)}`
              : ""}
          </p>
          <div className="twin-overlays">
            <OverlaySection
              title="אירועים פתוחים"
              summary={overlays?.openIncidents}
              badgeClass={overlays?.openIncidents.count ? "badge--warn" : undefined}
              renderMeta={(item) =>
                [item.severity, item.department, item.status]
                  .filter(Boolean)
                  .join(" · ")
              }
            />
            <OverlaySection
              title="תחזוקה חיזויית"
              summary={overlays?.predictiveAlerts}
              badgeClass={
                overlays?.predictiveAlerts.count ? "badge--warn" : undefined
              }
              renderMeta={(item) =>
                item.riskScore !== undefined
                  ? `סיכון ${item.riskScore} · ${item.status ?? "open"}`
                  : (item.status ?? "")
              }
            />
            <OverlaySection
              title="הצעות אנרגיה"
              summary={overlays?.energyHints}
              renderMeta={(item) =>
                item.estimatedSavingPct !== undefined
                  ? `חיסכון ~${item.estimatedSavingPct}% · ${item.status ?? "suggested"}`
                  : (item.status ?? "")
              }
            />
          </div>
          <ul>
            {twin.rooms.map((room) => (
              <li key={room.roomNumber}>
                חדר {room.roomNumber} · {room.status} · {room.source}
              </li>
            ))}
          </ul>
          {reservations.length > 0 ? (
            <>
              <h3>הזמנות PMS אחרונות</h3>
              <ul>
                {reservations.slice(0, 12).map((reservation) => (
                  <li key={reservation.externalReservationId}>
                    {reservation.externalReservationId}
                    {" · "}
                    חדר {reservation.roomNumber ?? "—"}
                    {" · "}
                    {reservation.checkInDate}→{reservation.checkOutDate}
                    {" · "}
                    {reservation.status}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : null}
      <style>{`
        .muted{opacity:.75}
        .hint{background:rgb(16 36 31 / 6%);padding:.75rem;border-radius:8px;font-size:var(--text-small, .875rem)}
        .error{color:#8b1e1e}
        .twin-overlays{display:grid;gap:.75rem;margin:1rem 0}
        .twin-overlay{padding:.75rem;border:1px solid var(--color-line-strong, rgb(16 36 31 / 12%));border-radius:var(--radius-sm, 8px);background:#fff}
        .twin-overlay h3{margin:0 0 .5rem;font-size:1rem;display:flex;align-items:center;gap:.5rem}
        .twin-overlay__list{margin:0;padding-inline-start:1.1rem;display:grid;gap:.35rem}
        .twin-overlay__meta{display:block;font-size:var(--text-small, .875rem);opacity:.8}
        .badge{padding:.15rem .5rem;border-radius:var(--radius-sm, 6px);background:rgb(16 36 31 / 8%);font-weight:700;font-size:var(--text-small, .875rem)}
        .badge--warn{background:var(--color-danger-soft, #fde8e8);color:var(--color-danger, #8b1e1e)}
      `}</style>
    </section>
  );
}
