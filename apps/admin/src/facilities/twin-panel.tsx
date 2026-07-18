import { useEffect, useState } from "react";
import { Button } from "@hotelos/ui";
import { fetchHotelTwin, syncHotelTwinPms, type HotelTwinDto } from "@hotelos/web-client";

export type TwinPanelProps = {
  readonly hotelId: string;
};

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

  return (
    <section>
      <h2>Digital Twin · חדרים</h2>
      <p className="muted">
        מיזוג מצב HotelOS עם מחבר PMS דמו (קריאה בלבד).
      </p>
      <Button type="button" onClick={() => void onSync()}>
        סנכרון PMS דמו
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
          </p>
          <ul>
            {twin.rooms.map((room) => (
              <li key={room.roomNumber}>
                חדר {room.roomNumber} · {room.status} · {room.source}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <style>{`
        .muted{opacity:.75}
        .hint{background:rgb(16 36 31 / 6%);padding:.75rem;border-radius:8px}
        .error{color:#8b1e1e}
      `}</style>
    </section>
  );
}
