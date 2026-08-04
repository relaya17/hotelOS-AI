import { useEffect, useState, type FormEvent } from "react";
import { Button, TextField } from "@hotelos/ui";
import {
  createPublicBooking,
  fetchPaymentPublicStatus,
  fetchPublicAvailability,
  listPublicHotels,
  type PaymentPublicStatusDto,
  type PublicAvailabilityOfferDto,
  type PublicHotelDto,
} from "@hotelos/web-client";

export type BookFlowProps = {
  readonly onCancel: () => void;
  readonly onBooked: (input: {
    readonly email: string;
    readonly bookingId: string;
  }) => void;
};

type Step = "dates" | "rooms" | "checkout";

function tomorrowIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function plusDaysIso(from: string, days: number): string {
  const d = new Date(`${from}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("he-IL", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `₪${Math.round(amount)}`;
  }
}

export function BookFlow({ onCancel, onBooked }: BookFlowProps) {
  const [step, setStep] = useState<Step>("dates");
  const [hotels, setHotels] = useState<readonly PublicHotelDto[]>([]);
  const [hotelId, setHotelId] = useState("");
  const [checkInDate, setCheckInDate] = useState(tomorrowIso);
  const [checkOutDate, setCheckOutDate] = useState(() =>
    plusDaysIso(tomorrowIso(), 2),
  );
  const [offers, setOffers] = useState<readonly PublicAvailabilityOfferDto[]>(
    [],
  );
  const [currency, setCurrency] = useState("ILS");
  const [hotelName, setHotelName] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [paymentStatus, setPaymentStatus] = useState<
    PaymentPublicStatusDto | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    void fetchPaymentPublicStatus()
      .then((status) => {
        if (!cancelled) setPaymentStatus(status);
      })
      .catch(() => {
        if (!cancelled) setPaymentStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listPublicHotels()
      .then((list) => {
        if (cancelled) return;
        setHotels(list);
        if (list[0]) {
          setHotelId(list[0].id);
          setCurrency(list[0].currency);
          setHotelName(list[0].name);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "טעינת מלונות נכשלה",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSearchDates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      const data = await fetchPublicAvailability({
        hotelId,
        checkInDate,
        checkOutDate,
      });
      setOffers(data.offers);
      setCurrency(data.currency);
      setHotelName(data.hotelName);
      setSelectedType(null);
      if (data.offers.length === 0) {
        setError("אין חדרים פנויים לתאריכים אלה");
      } else {
        setStep("rooms");
      }
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "חיפוש זמינות נכשל",
      );
    } finally {
      setLoading(false);
    }
  }

  async function onPay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedType) return;
    setLoading(true);
    setError(undefined);
    try {
      const result = await createPublicBooking({
        hotelId,
        roomType: selectedType,
        guestName,
        guestEmail,
        ...(guestPhone.trim() ? { guestPhone: guestPhone.trim() } : {}),
        checkInDate,
        checkOutDate,
      });
      onBooked({ email: result.guestEmail, bookingId: result.bookingId });
    } catch (bookError) {
      setError(
        bookError instanceof Error ? bookError.message : "ההזמנה נכשלה",
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedOffer = offers.find((offer) => offer.roomType === selectedType);

  return (
    <div className="book">
      <header className="book__head">
        <p className="hotelos-eyebrow">HotelOS · הזמנה</p>
        <h1>
          {step === "dates"
            ? "בחרו תאריכים"
            : step === "rooms"
              ? "בחרו חדר"
              : "פרטים ותשלום"}
        </h1>
        <p className="book__lede">
          {hotelName
            ? `${hotelName} · ${paymentStatus?.labelHe ?? "טוען מצב תשלום…"}`
            : "טוען מלונות…"}
        </p>
      </header>

      {step === "dates" ? (
        <form className="book__form" onSubmit={onSearchDates} noValidate>
          {hotels.length > 1 ? (
            <label className="book__field">
              <span>מלון</span>
              <select
                value={hotelId}
                onChange={(event) => {
                  setHotelId(event.target.value);
                  const hotel = hotels.find((h) => h.id === event.target.value);
                  if (hotel) {
                    setCurrency(hotel.currency);
                    setHotelName(hotel.name);
                  }
                }}
              >
                {hotels.map((hotel) => (
                  <option key={hotel.id} value={hotel.id}>
                    {hotel.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <TextField
            label="צ׳ק־אין"
            name="checkIn"
            type="date"
            value={checkInDate}
            onChange={(event) => {
              const next = event.target.value;
              setCheckInDate(next);
              if (checkOutDate <= next) {
                setCheckOutDate(plusDaysIso(next, 1));
              }
            }}
            required
          />
          <TextField
            label="צ׳ק־אאוט"
            name="checkOut"
            type="date"
            value={checkOutDate}
            onChange={(event) => setCheckOutDate(event.target.value)}
            required
          />
          {error ? <p className="book__error">{error}</p> : null}
          <div className="book__actions">
            <Button type="submit" disabled={loading || !hotelId}>
              {loading ? "בודק…" : "הצג חדרים"}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
              ביטול
            </Button>
          </div>
        </form>
      ) : null}

      {step === "rooms" ? (
        <div className="book__rooms">
          <p className="book__meta">
            {checkInDate} → {checkOutDate}
          </p>
          <ul className="book__offers">
            {offers.map((offer) => (
              <li key={offer.roomType}>
                <button
                  type="button"
                  className={
                    selectedType === offer.roomType
                      ? "book__offer book__offer--on"
                      : "book__offer"
                  }
                  onClick={() => setSelectedType(offer.roomType)}
                >
                  <span className="book__offer-title">{offer.labelHe}</span>
                  <span className="book__offer-meta">
                    מ־{formatMoney(offer.ratePerNight, currency)} / לילה ·{" "}
                    {offer.availableCount} פנויים
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {error ? <p className="book__error">{error}</p> : null}
          <div className="book__actions">
            <Button
              type="button"
              disabled={!selectedType}
              onClick={() => setStep("checkout")}
            >
              המשך לתשלום
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setStep("dates");
                setError(undefined);
              }}
            >
              שינוי תאריכים
            </Button>
          </div>
        </div>
      ) : null}

      {step === "checkout" && selectedOffer ? (
        <form className="book__form" onSubmit={onPay} noValidate>
          <p className="book__meta">
            {selectedOffer.labelHe} · {checkInDate} → {checkOutDate}
          </p>
          <TextField
            label="שם מלא"
            name="guestName"
            value={guestName}
            onChange={(event) => setGuestName(event.target.value)}
            required
            autoComplete="name"
          />
          <TextField
            label="אימייל"
            name="guestEmail"
            type="email"
            value={guestEmail}
            onChange={(event) => setGuestEmail(event.target.value)}
            required
            autoComplete="email"
          />
          <TextField
            label="טלפון (אופציונלי)"
            name="guestPhone"
            type="tel"
            value={guestPhone}
            onChange={(event) => setGuestPhone(event.target.value)}
            autoComplete="tel"
          />
          <p className="book__pay-note">
            {paymentStatus
              ? paymentStatus.labelHe
              : "טוען מצב תשלום מהשרת…"}{" "}
            לחיצה על «שלם והזמן» מאשרת הזמנה וכותבת רשומת כוונת תשלום
            (סכום/מטבע/סטטוס) בלבד. ספק נוכחי:{" "}
            <code>{paymentStatus?.provider ?? "…"}</code>.
          </p>
          {error ? <p className="book__error">{error}</p> : null}
          <div className="book__actions">
            <Button type="submit" disabled={loading}>
              {loading ? "מעבד…" : "שלם והזמן"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setStep("rooms");
                setError(undefined);
              }}
            >
              חזרה לחדרים
            </Button>
          </div>
        </form>
      ) : null}

      <style>{`
        .book {
          display: grid;
          gap: var(--space-5);
          animation: hotelos-enter var(--motion-med) var(--ease-out) both;
        }
        .book__head { display: grid; gap: var(--space-2); }
        .book__head h1 {
          font-size: clamp(1.6rem, 3vw, 2rem);
          color: var(--color-sea-deep);
        }
        .book__lede, .book__meta, .book__pay-note {
          color: var(--color-ink-soft);
          font-weight: 500;
          line-height: 1.6;
        }
        .book__form, .book__rooms { display: grid; gap: var(--space-4); }
        .book__field {
          display: grid;
          gap: 0.4rem;
          font-size: var(--text-small);
          font-weight: 600;
          color: var(--color-ink-soft);
        }
        .book__field select {
          font: inherit;
          font-weight: 500;
          color: var(--color-ink);
          border: 1px solid var(--color-line-strong);
          border-radius: var(--radius-sm);
          min-height: var(--touch-min, 2.75rem);
          padding: 0.65rem 0.8rem;
          background: var(--color-paper-elevated);
        }
        .book__offers {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 0.75rem;
        }
        .book__offer {
          width: 100%;
          text-align: start;
          display: grid;
          gap: 0.25rem;
          padding: 1rem 1.1rem;
          border: 1px solid var(--color-line);
          border-radius: var(--radius-sm);
          background: transparent;
          cursor: pointer;
          font: inherit;
          color: inherit;
          transition: border-color var(--motion-fast), background var(--motion-fast);
        }
        .book__offer:hover { border-color: var(--color-sea); }
        .book__offer--on {
          border-color: var(--color-sea);
          background: var(--color-sea-soft);
        }
        .book__offer-title {
          font-family: var(--font-display);
          font-size: 1.15rem;
          color: var(--color-sea-deep);
        }
        .book__offer-meta {
          color: var(--color-ink-soft);
          font-size: var(--text-small);
          font-weight: 500;
        }
        .book__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        .book__error {
          color: var(--color-danger);
          font-weight: 600;
          font-size: var(--text-small);
        }
      `}</style>
    </div>
  );
}
