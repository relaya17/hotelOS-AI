import { useEffect, useState, type FormEvent } from "react";
import { Button, TextField } from "@hotelos/ui";
import {
  createBooking,
  listBookings,
  listHotels,
  listRooms,
  updateBookingTransition,
  updateRoomStatus,
  type BookingDto,
  type HotelDto,
  type RoomDto,
  type StoredUser,
} from "@hotelos/web-client";

export type DashboardPageProps = {
  readonly user: StoredUser;
  /** When true (default), omits duplicate header chrome — nav lives in App shell. */
  readonly hideChrome?: boolean;
};

const roomStatusLabel: Record<RoomDto["status"], string> = {
  vacant: "פנוי",
  occupied: "תפוס",
  dirty: "ממתין לניקיון",
  maintenance: "תחזוקה",
};

const roomStatuses: readonly RoomDto["status"][] = [
  "vacant",
  "occupied",
  "dirty",
  "maintenance",
];

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

export function DashboardPage({ user, hideChrome = true }: DashboardPageProps) {
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
  const [actionError, setActionError] = useState<string | undefined>();
  const [busyRoomId, setBusyRoomId] = useState<string | undefined>();
  const [busyBookingId, setBusyBookingId] = useState<string | undefined>();
  const [roomId, setRoomId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [checkInDate, setCheckInDate] = useState("2026-07-21");
  const [checkOutDate, setCheckOutDate] = useState("2026-07-24");

  const vacantRooms = rooms.filter((room) => room.status === "vacant");
  const selectedHotel = hotels.find((hotel) => hotel.id === selectedHotelId);

  async function reloadOps(hotelId: string) {
    const [roomData, bookingData] = await Promise.all([
      listRooms(hotelId),
      listBookings(hotelId),
    ]);
    setRooms(roomData);
    setBookings(bookingData);
    return roomData;
  }

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
        const roomData = await reloadOps(hotelId);
        if (cancelled) return;
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
      const roomData = await reloadOps(selectedHotelId);
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

  async function onRoomStatusChange(
    room: RoomDto,
    status: RoomDto["status"],
  ) {
    if (selectedHotelId === undefined || room.status === status) return;
    setBusyRoomId(room.id);
    setActionError(undefined);
    try {
      const updated = await updateRoomStatus(selectedHotelId, room.id, status);
      setRooms((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (changeError) {
      setActionError(
        changeError instanceof Error ? changeError.message : "עדכון סטטוס נכשל",
      );
    } finally {
      setBusyRoomId(undefined);
    }
  }

  async function onBookingTransition(
    booking: BookingDto,
    transition: "check_in" | "check_out",
  ) {
    if (selectedHotelId === undefined) return;
    setBusyBookingId(booking.id);
    setActionError(undefined);
    try {
      const updated = await updateBookingTransition(
        selectedHotelId,
        booking.id,
        transition,
      );
      setBookings((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      const roomData = await listRooms(selectedHotelId);
      setRooms(roomData);
    } catch (transitionError) {
      setActionError(
        transitionError instanceof Error
          ? transitionError.message
          : "עדכון הזמנה נכשל",
      );
    } finally {
      setBusyBookingId(undefined);
    }
  }

  return (
    <main className="dash">
      {hideChrome ? (
        <header className="dash__header dash__header--compact">
          <div>
            <h1>{selectedHotel?.name ?? "בחרו מלון"}</h1>
            <p className="sub">{user.displayName}</p>
          </div>
        </header>
      ) : (
        <header className="dash__header">
          <div>
            <p className="eyebrow">Admin · תפעול מלון</p>
            <h1>{selectedHotel?.name ?? "בחרו מלון"}</h1>
            <p className="sub">{user.displayName}</p>
          </div>
        </header>
      )}

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

      {actionError !== undefined ? (
        <p className="state state--error banner-error" role="alert">
          {actionError}
        </p>
      ) : null}

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
                <div className="row__main">
                  <h3>חדר {room.number}</h3>
                  <p>
                    קומה {room.floor} · {room.roomType}
                  </p>
                </div>
                <div className="row__actions">
                  <span className={`status status--${room.status}`}>
                    {roomStatusLabel[room.status]}
                  </span>
                  <div
                    className="status-toggle"
                    role="group"
                    aria-label={`סטטוס חדר ${room.number}`}
                  >
                    {roomStatuses.map((status) => (
                      <button
                        key={status}
                        type="button"
                        className={
                          room.status === status
                            ? "chip chip--on"
                            : "chip"
                        }
                        disabled={busyRoomId === room.id}
                        aria-pressed={room.status === status}
                        onClick={() => {
                          void onRoomStatusChange(room, status);
                        }}
                      >
                        {roomStatusLabel[status]}
                      </button>
                    ))}
                  </div>
                </div>
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
                <div className="row__main">
                  <h3>{booking.guestName}</h3>
                  <p>
                    חדר {booking.roomNumber} · {booking.checkInDate} →{" "}
                    {booking.checkOutDate}
                  </p>
                </div>
                <div className="row__actions">
                  <span
                    className={`status status--booking-${booking.status}`}
                  >
                    {bookingStatusLabel[booking.status]}
                  </span>
                  {booking.status === "confirmed" ? (
                    <Button
                      type="button"
                      disabled={busyBookingId === booking.id}
                      onClick={() => {
                        void onBookingTransition(booking, "check_in");
                      }}
                    >
                      {busyBookingId === booking.id ? "…" : "צ׳ק־אין"}
                    </Button>
                  ) : null}
                  {booking.status === "checked_in" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busyBookingId === booking.id}
                      onClick={() => {
                        void onBookingTransition(booking, "check_out");
                      }}
                    >
                      {busyBookingId === booking.id ? "…" : "צ׳ק־אאוט"}
                    </Button>
                  ) : null}
                </div>
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
        .dash { padding:clamp(1rem,3vw,2rem); display:grid; gap:var(--space-5); }
        .dash__header { display:flex; justify-content:space-between; gap:var(--space-4); align-items:flex-start; }
        .dash__header--compact h1 { font-size:var(--text-title); margin:0; }
        .eyebrow { margin:0 0 var(--space-2); letter-spacing:.08em; text-transform:uppercase; font-size:var(--text-small); color:var(--color-sea-deep); font-weight:700; }
        h1 { font-size:var(--text-display); margin:0; }
        .sub { margin:var(--space-2) 0 0; color:var(--color-ink-soft); font-size:var(--text-small); }
        .card { background:rgb(255 250 242 / 90%); border:1px solid rgb(16 36 31 / 10%); border-radius:calc(var(--radius-md) + .1rem); box-shadow:var(--shadow-soft); padding:clamp(1.2rem,2.5vw,1.8rem); }
        .card h2 { margin:0; font-size:var(--text-title); }
        .hint { margin:var(--space-2) 0 var(--space-4); color:var(--color-ink-soft); }
        .list { list-style:none; margin:0; padding:0; display:grid; gap:var(--space-3); }
        .row { display:flex; flex-wrap:wrap; justify-content:space-between; gap:var(--space-3); align-items:center; padding:var(--space-4); border:1px solid rgb(16 36 31 / 10%); border-radius:var(--radius-sm); background:var(--color-paper-elevated); }
        .row__main { flex:1 1 12rem; min-width:0; }
        .row__actions { display:flex; flex-wrap:wrap; gap:var(--space-2); align-items:center; justify-content:flex-end; }
        .row h3 { margin:0; font-family:var(--font-display); font-size:1.2rem; }
        .row p { margin:var(--space-1) 0 0; color:var(--color-ink-soft); font-size:var(--text-small); }
        .status { font-size:var(--text-small); font-weight:700; padding:.35rem .7rem; border-radius:999px; white-space:nowrap; }
        .status--vacant { color:#0f6a5c; background:rgb(15 106 92 / 12%); }
        .status--occupied { color:#1f4b7a; background:rgb(31 75 122 / 12%); }
        .status--dirty { color:#8a5a12; background:rgb(138 90 18 / 12%); }
        .status--maintenance { color:#9b2c2c; background:rgb(155 44 44 / 12%); }
        .status--booking-confirmed { color:#0f6a5c; background:rgb(15 106 92 / 12%); }
        .status--booking-checked_in { color:#1f4b7a; background:rgb(31 75 122 / 12%); }
        .status--booking-checked_out { color:#445; background:rgb(68 68 85 / 10%); }
        .status--booking-cancelled { color:#9b2c2c; background:rgb(155 44 44 / 12%); }
        .status-toggle { display:flex; flex-wrap:wrap; gap:.35rem; max-width:22rem; }
        .chip { font:inherit; font-size:.75rem; font-weight:600; padding:.35rem .55rem; border-radius:999px; border:1px solid rgb(16 36 31 / 14%); background:transparent; cursor:pointer; color:var(--color-ink-soft); }
        .chip:disabled { opacity:.55; cursor:wait; }
        .chip--on { background:var(--color-sea-deep); color:#fff; border-color:transparent; }
        .create-form { margin-top:var(--space-5); display:grid; gap:var(--space-3); border-top:1px solid rgb(16 36 31 / 10%); padding-top:var(--space-4); }
        .create-form h3 { margin:0; font-family:var(--font-display); }
        .select-field { display:grid; gap:var(--space-2); }
        .select-field span { font-size:var(--text-small); font-weight:600; color:var(--color-ink-soft); }
        .select-field select { font:inherit; border:1px solid rgb(16 36 31 / 18%); border-radius:var(--radius-sm); padding:.85rem .95rem; background:var(--color-paper-elevated); }
        .state { margin:0; color:var(--color-ink-soft); }
        .state--error { color:var(--color-danger); }
        .banner-error { padding:var(--space-3) var(--space-4); background:rgb(155 44 44 / 8%); border-radius:var(--radius-sm); }
        @media (max-width:640px) {
          .status-toggle { max-width:none; }
          .row__actions { width:100%; justify-content:flex-start; }
        }
      `}</style>
    </main>
  );
}
