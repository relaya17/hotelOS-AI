import { useEffect, useState, type FormEvent } from "react";
import { Button, TextField } from "@hotelos/ui";
import {
  APP_URLS,
  clearSession,
  createBooking,
  listBookings,
  listHotels,
  listRooms,
  type BookingDto,
  type HotelDto,
  type RoomDto,
  type StoredUser,
} from "@hotelos/web-client";

export type DashboardPageProps = {
  readonly user: StoredUser;
  readonly onLogout: () => void;
};

const roomStatusLabel: Record<RoomDto["status"], string> = {
  vacant: "פנוי",
  occupied: "תפוס",
  dirty: "ממתין לניקיון",
  maintenance: "תחזוקה",
};

const bookingStatusLabel: Record<BookingDto["status"], string> = {
  confirmed: "מאושרת",
  checked_in: "בבית המלון",
  checked_out: "עשתה צ׳ק־אאוט",
  cancelled: "בוטלה",
};

function readHotelIdFromUrl(): string | undefined {
  const value = new URLSearchParams(window.location.search).get("hotelId");
  return value && value.length > 0 ? value : undefined;
}

export function DashboardPage({ user, onLogout }: DashboardPageProps) {
  const [hotels, setHotels] = useState<readonly HotelDto[]>([]);
  const [selectedHotelId, setSelectedHotelId] = useState<string | undefined>(
    readHotelIdFromUrl(),
  );
  const [rooms, setRooms] = useState<readonly RoomDto[]>([]);
  const [bookings, setBookings] = useState<readonly BookingDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [opsLoading, setOpsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [opsError, setOpsError] = useState<string | undefined>();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | undefined>();
  const [roomId, setRoomId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [checkInDate, setCheckInDate] = useState("2026-07-21");
  const [checkOutDate, setCheckOutDate] = useState("2026-07-24");

  const vacantRooms = rooms.filter((room) => room.status === "vacant");
  const selectedHotel = hotels.find((hotel) => hotel.id === selectedHotelId);

  useEffect(() => {
    let cancelled = false;
    async function loadHotels() {
      setLoading(true);
      setError(undefined);
      try {
        const data = await listHotels();
        if (cancelled) return;
        setHotels(data);
        const fromUrl = readHotelIdFromUrl();
        const exists = data.some((hotel) => hotel.id === fromUrl);
        if (fromUrl && exists) {
          setSelectedHotelId(fromUrl);
        } else if (data[0]) {
          setSelectedHotelId(data[0].id);
        }
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
    void loadHotels();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedHotelId === undefined) {
      setRooms([]);
      setBookings([]);
      return;
    }
    const hotelId = selectedHotelId;
    const url = new URL(window.location.href);
    url.searchParams.set("hotelId", hotelId);
    window.history.replaceState({}, "", url.toString());

    let cancelled = false;
    async function loadOps() {
      setOpsLoading(true);
      setOpsError(undefined);
      try {
        const [roomData, bookingData] = await Promise.all([
          listRooms(hotelId),
          listBookings(hotelId),
        ]);
        if (cancelled) return;
        setRooms(roomData);
        setBookings(bookingData);
        const firstVacant = roomData.find((room) => room.status === "vacant");
        setRoomId(firstVacant?.id ?? "");
      } catch (loadError) {
        if (!cancelled) {
          setOpsError(
            loadError instanceof Error ? loadError.message : "שגיאה בטעינה",
          );
        }
      } finally {
        if (!cancelled) setOpsLoading(false);
      }
    }
    void loadOps();
    return () => {
      cancelled = true;
    };
  }, [selectedHotelId]);

  async function onCreateBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedHotelId === undefined || roomId === "") {
      setCreateError("בחרו מלון וחדר פנוי");
      return;
    }
    setCreating(true);
    setCreateError(undefined);
    try {
      await createBooking(selectedHotelId, {
        roomId,
        guestName,
        guestEmail,
        checkInDate,
        checkOutDate,
        status: "confirmed",
      });
      const [roomData, bookingData] = await Promise.all([
        listRooms(selectedHotelId),
        listBookings(selectedHotelId),
      ]);
      setRooms(roomData);
      setBookings(bookingData);
      setGuestName("");
      setGuestEmail("");
      setRoomId(roomData.find((room) => room.status === "vacant")?.id ?? "");
    } catch (submitError) {
      setCreateError(
        submitError instanceof Error ? submitError.message : "יצירה נכשלה",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="dash">
      <header className="dash__header">
        <div>
          <p className="eyebrow">Admin · תפעול מלון</p>
          <h1>{selectedHotel?.name ?? "בחרו מלון"}</h1>
          <p className="sub">
            {user.displayName} · אפליקציה נפרדת מתפעול הרשת
          </p>
        </div>
        <div className="actions">
          <a className="link" href={APP_URLS.executive}>
            לוח בקרה לרשת
          </a>
          <Button
            variant="ghost"
            type="button"
            onClick={() => {
              clearSession();
              onLogout();
            }}
          >
            התנתקות
          </Button>
        </div>
      </header>

      <section className="card">
        <h2>מלון פעיל</h2>
        <p className="hint">
          הרשת יכולה לכלול כמה מלונות — כאן עובדים על מלון אחד בלבד.
        </p>
        {loading ? <p className="state">טוען…</p> : null}
        {error !== undefined ? (
          <p className="state state--error" role="alert">
            {error}
          </p>
        ) : null}
        <label className="select-field">
          <span>בחירת מלון</span>
          <select
            value={selectedHotelId ?? ""}
            onChange={(event) => {
              setSelectedHotelId(event.target.value);
            }}
          >
            {hotels.map((hotel) => (
              <option key={hotel.id} value={hotel.id}>
                {hotel.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card">
        <h2>חדרים</h2>
        {opsLoading ? <p className="state">טוען חדרים…</p> : null}
        {opsError !== undefined ? (
          <p className="state state--error" role="alert">
            {opsError}
          </p>
        ) : null}
        {!opsLoading && opsError === undefined ? (
          <ul className="list">
            {rooms.map((room) => (
              <li key={room.id} className="row">
                <div>
                  <h3>חדר {room.number}</h3>
                  <p>
                    קומה {room.floor} · {room.roomType}
                  </p>
                </div>
                <span className={`status status--${room.status}`}>
                  {roomStatusLabel[room.status]}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="card">
        <h2>הזמנות</h2>
        {!opsLoading && opsError === undefined ? (
          <ul className="list">
            {bookings.map((booking) => (
              <li key={booking.id} className="row">
                <div>
                  <h3>{booking.guestName}</h3>
                  <p>
                    חדר {booking.roomNumber} · {booking.checkInDate} →{" "}
                    {booking.checkOutDate}
                  </p>
                </div>
                <span className={`status status--booking-${booking.status}`}>
                  {bookingStatusLabel[booking.status]}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <form className="create-form" onSubmit={onCreateBooking} noValidate>
          <h3>הזמנה חדשה במלון זה</h3>
          <label className="select-field">
            <span>חדר פנוי</span>
            <select
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              required
            >
              <option value="" disabled>
                בחרו חדר
              </option>
              {vacantRooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.number} · {room.roomType}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="שם אורח"
            name="guestName"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            required
          />
          <TextField
            label="אימייל אורח"
            name="guestEmail"
            type="email"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            required
          />
          <TextField
            label="צ׳ק־אין"
            name="checkInDate"
            type="date"
            value={checkInDate}
            onChange={(e) => setCheckInDate(e.target.value)}
            required
          />
          <TextField
            label="צ׳ק־אאוט"
            name="checkOutDate"
            type="date"
            value={checkOutDate}
            onChange={(e) => setCheckOutDate(e.target.value)}
            required
          />
          {createError !== undefined ? (
            <p className="state state--error" role="alert">
              {createError}
            </p>
          ) : null}
          <Button type="submit" disabled={creating || vacantRooms.length === 0}>
            {creating ? "יוצר…" : "צור הזמנה"}
          </Button>
        </form>
      </section>

      <style>{`
        .dash { min-height:100vh; padding:clamp(1.25rem,3vw,2.5rem); display:grid; gap:var(--space-5); }
        .dash__header { display:flex; justify-content:space-between; gap:var(--space-4); }
        .actions { display:flex; gap:var(--space-3); align-items:center; }
        .link { color:var(--color-sea-deep); font-weight:600; }
        .eyebrow { margin:0 0 var(--space-2); letter-spacing:.08em; text-transform:uppercase; font-size:var(--text-small); color:var(--color-sea-deep); font-weight:700; }
        h1 { font-size:var(--text-display); margin:0; }
        .sub { margin:var(--space-2) 0 0; color:var(--color-ink-soft); }
        .card { background:rgb(255 250 242 / 90%); border:1px solid rgb(16 36 31 / 10%); border-radius:calc(var(--radius-md) + .1rem); box-shadow:var(--shadow-soft); padding:clamp(1.2rem,2.5vw,1.8rem); }
        .card h2 { margin:0; font-size:var(--text-title); }
        .hint { margin:var(--space-2) 0 var(--space-4); color:var(--color-ink-soft); }
        .list { list-style:none; margin:0; padding:0; display:grid; gap:var(--space-3); }
        .row { display:flex; justify-content:space-between; gap:var(--space-3); align-items:center; padding:var(--space-4); border:1px solid rgb(16 36 31 / 10%); border-radius:var(--radius-sm); background:var(--color-paper-elevated); }
        .row h3 { margin:0; font-family:var(--font-display); font-size:1.2rem; }
        .row p { margin:var(--space-1) 0 0; color:var(--color-ink-soft); font-size:var(--text-small); }
        .status { font-size:var(--text-small); font-weight:700; padding:.35rem .7rem; border-radius:999px; }
        .status--vacant { color:#0f6a5c; background:rgb(15 106 92 / 12%); }
        .status--occupied { color:#1f4b7a; background:rgb(31 75 122 / 12%); }
        .status--dirty { color:#8a5a12; background:rgb(138 90 18 / 12%); }
        .status--maintenance { color:#9b2c2c; background:rgb(155 44 44 / 12%); }
        .status--booking-confirmed { color:#0f6a5c; background:rgb(15 106 92 / 12%); }
        .status--booking-checked_in { color:#1f4b7a; background:rgb(31 75 122 / 12%); }
        .status--booking-checked_out { color:#445; background:rgb(68 68 85 / 10%); }
        .status--booking-cancelled { color:#9b2c2c; background:rgb(155 44 44 / 12%); }
        .create-form { margin-top:var(--space-5); display:grid; gap:var(--space-3); border-top:1px solid rgb(16 36 31 / 10%); padding-top:var(--space-4); }
        .create-form h3 { margin:0; font-family:var(--font-display); }
        .select-field { display:grid; gap:var(--space-2); }
        .select-field span { font-size:var(--text-small); font-weight:600; color:var(--color-ink-soft); }
        .select-field select { font:inherit; border:1px solid rgb(16 36 31 / 18%); border-radius:var(--radius-sm); padding:.85rem .95rem; background:var(--color-paper-elevated); }
        .state { margin:0; color:var(--color-ink-soft); }
        .state--error { color:var(--color-danger); }
      `}</style>
    </div>
  );
}
