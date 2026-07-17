import { useEffect, useState, type FormEvent } from "react";
import { Button, TextField } from "@hotelos/ui";
import {
  createBooking,
  listBookings,
  listHotels,
  listRooms,
  type BookingDto,
  type HotelDto,
  type RoomDto,
} from "./api-client.js";
import { clearSession, type StoredUser } from "./session.js";

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

export function DashboardPage({ user, onLogout }: DashboardPageProps) {
  const [hotels, setHotels] = useState<readonly HotelDto[]>([]);
  const [selectedHotelId, setSelectedHotelId] = useState<string | undefined>();
  const [rooms, setRooms] = useState<readonly RoomDto[]>([]);
  const [bookings, setBookings] = useState<readonly BookingDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [roomsError, setRoomsError] = useState<string | undefined>();
  const [bookingsError, setBookingsError] = useState<string | undefined>();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | undefined>();

  const vacantRooms = rooms.filter((room) => room.status === "vacant");
  const [roomId, setRoomId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [checkInDate, setCheckInDate] = useState("2026-07-21");
  const [checkOutDate, setCheckOutDate] = useState("2026-07-24");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(undefined);
      try {
        const data = await listHotels();
        if (!cancelled) {
          setHotels(data);
          const first = data[0];
          if (first) {
            setSelectedHotelId(first.id);
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "שגיאה בטעינה",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
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
    let cancelled = false;

    async function loadHotelData() {
      setRoomsLoading(true);
      setBookingsLoading(true);
      setRoomsError(undefined);
      setBookingsError(undefined);
      try {
        const [roomData, bookingData] = await Promise.all([
          listRooms(hotelId),
          listBookings(hotelId),
        ]);
        if (!cancelled) {
          setRooms(roomData);
          setBookings(bookingData);
          const firstVacant = roomData.find((room) => room.status === "vacant");
          setRoomId(firstVacant?.id ?? "");
        }
      } catch (loadError) {
        if (!cancelled) {
          const message =
            loadError instanceof Error ? loadError.message : "שגיאה בטעינה";
          setRoomsError(message);
          setBookingsError(message);
        }
      } finally {
        if (!cancelled) {
          setRoomsLoading(false);
          setBookingsLoading(false);
        }
      }
    }

    void loadHotelData();
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
      const nextVacant = roomData.find((room) => room.status === "vacant");
      setRoomId(nextVacant?.id ?? "");
    } catch (submitError) {
      setCreateError(
        submitError instanceof Error ? submitError.message : "יצירה נכשלה",
      );
    } finally {
      setCreating(false);
    }
  }

  function logout() {
    clearSession();
    onLogout();
  }

  const selectedHotel = hotels.find((hotel) => hotel.id === selectedHotelId);

  return (
    <div className="dash">
      <header className="dash__header">
        <div>
          <p className="eyebrow">HotelOS AI</p>
          <h1>לוח בקרה</h1>
          <p className="sub">
            שלום {user.displayName} · {user.roles.join(" · ")}
          </p>
        </div>
        <Button variant="ghost" type="button" onClick={logout}>
          התנתקות
        </Button>
      </header>

      <section className="card" aria-labelledby="hotels-title">
        <h2 id="hotels-title">מלונות ברשת</h2>
        <p className="hint">בחרו מלון כדי לראות חדרים והזמנות</p>
        {loading ? <p className="state">טוען מלונות…</p> : null}
        {error !== undefined ? (
          <p className="state state--error" role="alert">
            {error}
          </p>
        ) : null}
        {!loading && error === undefined ? (
          <ul className="hotel-list">
            {hotels.map((hotel, index) => {
              const selected = hotel.id === selectedHotelId;
              return (
                <li key={hotel.id}>
                  <button
                    type="button"
                    className={`hotel-item${selected ? " hotel-item--selected" : ""}`}
                    style={{ animationDelay: `${index * 80}ms` }}
                    onClick={() => {
                      setSelectedHotelId(hotel.id);
                    }}
                    aria-pressed={selected}
                  >
                    <div>
                      <h3>{hotel.name}</h3>
                      <p>
                        {hotel.timezone} · {hotel.currency}
                      </p>
                    </div>
                    <span className="badge">{selected ? "נבחר" : "פעיל"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <section className="card" aria-labelledby="rooms-title">
        <h2 id="rooms-title">
          חדרים{selectedHotel ? ` · ${selectedHotel.name}` : ""}
        </h2>
        {roomsLoading ? <p className="state">טוען חדרים…</p> : null}
        {roomsError !== undefined ? (
          <p className="state state--error" role="alert">
            {roomsError}
          </p>
        ) : null}
        {!roomsLoading && roomsError === undefined ? (
          <ul className="room-list">
            {rooms.map((room) => (
              <li key={room.id} className="room-item">
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

      <section className="card" aria-labelledby="bookings-title">
        <h2 id="bookings-title">הזמנות</h2>
        {bookingsLoading ? <p className="state">טוען הזמנות…</p> : null}
        {bookingsError !== undefined ? (
          <p className="state state--error" role="alert">
            {bookingsError}
          </p>
        ) : null}
        {!bookingsLoading && bookingsError === undefined ? (
          <ul className="room-list">
            {bookings.map((booking) => (
              <li key={booking.id} className="room-item">
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
          <h3>הזמנה חדשה</h3>
          <label className="select-field">
            <span>חדר פנוי</span>
            <select
              value={roomId}
              onChange={(event) => {
                setRoomId(event.target.value);
              }}
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
            onChange={(event) => {
              setGuestName(event.target.value);
            }}
            required
          />
          <TextField
            label="אימייל אורח"
            name="guestEmail"
            type="email"
            value={guestEmail}
            onChange={(event) => {
              setGuestEmail(event.target.value);
            }}
            required
          />
          <TextField
            label="צ׳ק־אין"
            name="checkInDate"
            type="date"
            value={checkInDate}
            onChange={(event) => {
              setCheckInDate(event.target.value);
            }}
            required
          />
          <TextField
            label="צ׳ק־אאוט"
            name="checkOutDate"
            type="date"
            value={checkOutDate}
            onChange={(event) => {
              setCheckOutDate(event.target.value);
            }}
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
        .dash {
          min-height: 100vh;
          padding: clamp(1.25rem, 3vw, 2.5rem);
          display: grid;
          gap: var(--space-5);
          align-content: start;
        }
        .dash__header {
          display: flex;
          justify-content: space-between;
          gap: var(--space-4);
          align-items: start;
        }
        .eyebrow {
          margin: 0 0 var(--space-2);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-size: var(--text-small);
          color: var(--color-sea-deep);
          font-weight: 700;
        }
        h1 { font-size: var(--text-display); margin: 0; }
        .sub { margin: var(--space-2) 0 0; color: var(--color-ink-soft); }
        .card {
          background: rgb(255 250 242 / 90%);
          border: 1px solid rgb(16 36 31 / 10%);
          border-radius: calc(var(--radius-md) + 0.1rem);
          box-shadow: var(--shadow-soft);
          padding: clamp(1.2rem, 2.5vw, 1.8rem);
          animation: rise 380ms ease both;
        }
        .card h2 { font-size: var(--text-title); margin: 0; }
        .hint { margin: var(--space-2) 0 var(--space-4); color: var(--color-ink-soft); }
        .hotel-list, .room-list {
          list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3);
        }
        .hotel-item, .room-item {
          display: flex; justify-content: space-between; gap: var(--space-3);
          align-items: center; width: 100%; text-align: start;
          padding: var(--space-4); border: 1px solid rgb(16 36 31 / 10%);
          border-radius: var(--radius-sm); background: var(--color-paper-elevated);
          color: inherit; font: inherit; animation: rise 420ms ease both;
        }
        .hotel-item { cursor: pointer; }
        .hotel-item--selected {
          border-color: rgb(15 106 92 / 45%);
          box-shadow: inset 0 0 0 1px rgb(15 106 92 / 25%);
        }
        .hotel-item h3, .room-item h3 {
          margin: 0; font-family: var(--font-display); font-size: 1.25rem;
        }
        .hotel-item p, .room-item p {
          margin: var(--space-1) 0 0; color: var(--color-ink-soft); font-size: var(--text-small);
        }
        .badge, .status {
          font-size: var(--text-small); font-weight: 700;
          padding: 0.35rem 0.7rem; border-radius: 999px; white-space: nowrap;
        }
        .badge { color: var(--color-sea-deep); background: rgb(15 106 92 / 12%); }
        .status--vacant { color: #0f6a5c; background: rgb(15 106 92 / 12%); }
        .status--occupied { color: #1f4b7a; background: rgb(31 75 122 / 12%); }
        .status--dirty { color: #8a5a12; background: rgb(138 90 18 / 12%); }
        .status--maintenance { color: #9b2c2c; background: rgb(155 44 44 / 12%); }
        .status--booking-confirmed { color: #0f6a5c; background: rgb(15 106 92 / 12%); }
        .status--booking-checked_in { color: #1f4b7a; background: rgb(31 75 122 / 12%); }
        .status--booking-checked_out { color: #445; background: rgb(68 68 85 / 10%); }
        .status--booking-cancelled { color: #9b2c2c; background: rgb(155 44 44 / 12%); }
        .create-form {
          margin-top: var(--space-5);
          display: grid;
          gap: var(--space-3);
          border-top: 1px solid rgb(16 36 31 / 10%);
          padding-top: var(--space-4);
        }
        .create-form h3 {
          margin: 0;
          font-family: var(--font-display);
          font-size: 1.2rem;
        }
        .select-field {
          display: grid;
          gap: var(--space-2);
        }
        .select-field span {
          font-size: var(--text-small);
          font-weight: 600;
          color: var(--color-ink-soft);
        }
        .select-field select {
          font: inherit;
          border: 1px solid rgb(16 36 31 / 18%);
          border-radius: var(--radius-sm);
          padding: 0.85rem 0.95rem;
          background: var(--color-paper-elevated);
        }
        .state { margin: 0; color: var(--color-ink-soft); }
        .state--error { color: var(--color-danger); }
        @keyframes rise {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
