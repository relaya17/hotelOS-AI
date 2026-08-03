import { useEffect, useMemo, useState } from "react";
import { Button } from "@hotelos/ui";
import {
  fetchHotelTwin,
  syncHotelTwinPms,
  type HotelTwinDto,
  type HotelTwinOverlaySummaryDto,
  type TwinEquipmentNodeDto,
} from "@hotelos/web-client";

export type TwinPanelProps = {
  readonly hotelId: string;
};

const CATEGORY_LABEL: Record<TwinEquipmentNodeDto["category"], string> = {
  hvac: "מזגנים",
  elevator: "מעליות",
  boiler: "מים ודודי",
  other: "אחר",
};

const HEALTH_LABEL: Record<TwinEquipmentNodeDto["health"], string> = {
  critical: "קריטי",
  warning: "אזהרה",
  ok: "תקין",
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

function EquipmentSection({
  equipment,
}: {
  readonly equipment: readonly TwinEquipmentNodeDto[];
}) {
  const grouped = useMemo(() => {
    const groups: Record<
      TwinEquipmentNodeDto["category"],
      TwinEquipmentNodeDto[]
    > = {
      hvac: [],
      elevator: [],
      boiler: [],
      other: [],
    };
    for (const node of equipment) {
      groups[node.category].push(node);
    }
    return groups;
  }, [equipment]);

  if (equipment.length === 0) {
    return (
      <section className="twin-equipment">
        <h3>ציוד חי</h3>
        <p className="hint">
          אין נכסי ציוד רשומים למלון. הוסיפו נכסים דרך ingest או הריצו סריקת
          תחזוקה חיזויית בלשונית «תחזוקה, תיקונים ושיפוצים» כדי לאכלס נכסים
          וחיזויים.
        </p>
      </section>
    );
  }

  return (
    <section className="twin-equipment">
      <h3>
        ציוד חי{" "}
        <span className="badge">{equipment.length}</span>
      </h3>
      {(
        Object.entries(grouped) as [
          TwinEquipmentNodeDto["category"],
          TwinEquipmentNodeDto[],
        ][]
      ).map(([category, nodes]) =>
        nodes.length === 0 ? null : (
          <div key={category} className="twin-equipment__group">
            <h4>{CATEGORY_LABEL[category]}</h4>
            <ul className="twin-equipment__list">
              {nodes.map((node) => (
                <li key={node.assetId}>
                  <div className="twin-equipment__row">
                    <strong>
                      {node.assetCode} · {node.nameHe}
                    </strong>
                    <span
                      className={`twin-health twin-health--${node.health}`}
                    >
                      {HEALTH_LABEL[node.health]}
                    </span>
                  </div>
                  <span className="twin-overlay__meta">
                    {node.locationHe}
                    {node.openPrediction
                      ? ` · סיכון ${node.openPrediction.riskScore}`
                      : ""}
                    {node.latestSignals.length > 0
                      ? ` · ${node.latestSignals.length} אותות אחרונים`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ),
      )}
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
  const equipment = twin?.equipment ?? [];

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
          <EquipmentSection equipment={equipment} />
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
                [
                  item.assetCode,
                  item.riskScore !== undefined
                    ? `סיכון ${item.riskScore}`
                    : undefined,
                  item.status,
                ]
                  .filter(Boolean)
                  .join(" · ")
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
        .twin-equipment{margin:1rem 0;padding:.75rem;border:1px solid var(--color-line-strong, rgb(16 36 31 / 12%));border-radius:var(--radius-sm, 8px);background:#fff}
        .twin-equipment h3{margin:0 0 .75rem;font-size:1rem;display:flex;align-items:center;gap:.5rem}
        .twin-equipment h4{margin:0 0 .35rem;font-size:var(--text-small, .875rem);opacity:.85}
        .twin-equipment__group + .twin-equipment__group{margin-top:.75rem;padding-top:.75rem;border-top:1px solid rgb(16 36 31 / 8%)}
        .twin-equipment__list{margin:0;padding-inline-start:1.1rem;display:grid;gap:.45rem}
        .twin-equipment__row{display:flex;justify-content:space-between;gap:.5rem;align-items:center;flex-wrap:wrap}
        .twin-health{padding:.1rem .45rem;border-radius:var(--radius-sm, 6px);font-size:var(--text-micro, .75rem);font-weight:700}
        .twin-health--ok{background:rgb(16 120 80 / 12%);color:#107850}
        .twin-health--warning{background:var(--color-danger-soft, #fde8e8);color:#9a5b00}
        .twin-health--critical{background:var(--color-danger-soft, #fde8e8);color:var(--color-danger, #8b1e1e)}
        .badge{padding:.15rem .5rem;border-radius:var(--radius-sm, 6px);background:rgb(16 36 31 / 8%);font-weight:700;font-size:var(--text-small, .875rem)}
        .badge--warn{background:var(--color-danger-soft, #fde8e8);color:var(--color-danger, #8b1e1e)}
      `}</style>
    </section>
  );
}
