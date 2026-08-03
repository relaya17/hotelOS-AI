import { useEffect, useState } from "react";
import { Button } from "@hotelos/ui";
import {
  decideGuestUpsell,
  listGuestUpsells,
  suggestGuestUpsells,
  type BookingDto,
  type UpsellOfferDto,
} from "@hotelos/web-client";

export type BookingUpsellPanelProps = {
  readonly hotelId: string;
  readonly booking: BookingDto;
};

const statusLabel: Record<UpsellOfferDto["status"], string> = {
  suggested: "מוצע",
  accepted: "אושר",
  declined: "נדחה",
  expired: "פג תוקף",
};

export function BookingUpsellPanel({ hotelId, booking }: BookingUpsellPanelProps) {
  const [offers, setOffers] = useState<readonly UpsellOfferDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggesting, setSuggesting] = useState(false);
  const [busyId, setBusyId] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(undefined);
      try {
        const list = await listGuestUpsells({
          hotelId,
          bookingId: booking.id,
        });
        if (!cancelled) setOffers(list);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "טעינת הצעות נכשלה",
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
  }, [hotelId, booking.id]);

  async function onSuggest() {
    setSuggesting(true);
    setError(undefined);
    try {
      const created = await suggestGuestUpsells({
        hotelId,
        bookingId: booking.id,
      });
      setOffers(created);
    } catch (suggestError) {
      setError(
        suggestError instanceof Error
          ? suggestError.message
          : "יצירת הצעות נכשלה",
      );
    } finally {
      setSuggesting(false);
    }
  }

  async function onDecide(
    offerId: string,
    decision: "accepted" | "declined",
  ) {
    setBusyId(offerId);
    setError(undefined);
    try {
      const updated = await decideGuestUpsell({
        hotelId,
        offerId,
        decision,
      });
      setOffers((current) =>
        current.map((offer) => (offer.id === updated.id ? updated : offer)),
      );
    } catch (decideError) {
      setError(
        decideError instanceof Error ? decideError.message : "עדכון נכשל",
      );
    } finally {
      setBusyId(undefined);
    }
  }

  if (booking.status === "checked_out" || booking.status === "cancelled") {
    return null;
  }

  return (
    <div className="upsell-panel">
      <div className="upsell-panel__head">
        <h4>הצעות Upsell</h4>
        <Button
          type="button"
          variant="ghost"
          disabled={suggesting}
          onClick={() => void onSuggest()}
        >
          {suggesting ? "…" : "הצע upsells"}
        </Button>
      </div>
      {loading ? <p className="upsell-panel__hint">טוען…</p> : null}
      {error ? (
        <p className="upsell-panel__error" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && offers.length === 0 ? (
        <p className="upsell-panel__hint">אין הצעות — לחצו «הצע upsells».</p>
      ) : null}
      <ul className="upsell-panel__list">
        {offers.map((offer) => (
          <li key={offer.id}>
            <div>
              <strong>{offer.titleHe}</strong>
              <span className="upsell-panel__status">
                {statusLabel[offer.status]}
              </span>
              <p>{offer.descriptionHe}</p>
            </div>
            {offer.status === "suggested" ? (
              <div className="upsell-panel__actions">
                <Button
                  type="button"
                  disabled={busyId === offer.id}
                  onClick={() => void onDecide(offer.id, "accepted")}
                >
                  אשר
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busyId === offer.id}
                  onClick={() => void onDecide(offer.id, "declined")}
                >
                  דחה
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <style>{`
        .upsell-panel { margin-top:var(--space-3); padding-top:var(--space-3); border-top:1px dashed var(--color-line); display:grid; gap:var(--space-2); }
        .upsell-panel__head { display:flex; justify-content:space-between; align-items:center; gap:var(--space-2); flex-wrap:wrap; }
        .upsell-panel h4 { margin:0; font-size:var(--text-small); }
        .upsell-panel__hint { margin:0; color:var(--color-ink-soft); font-size:var(--text-small); }
        .upsell-panel__error { margin:0; color:var(--color-danger); font-size:var(--text-small); }
        .upsell-panel__list { list-style:none; margin:0; padding:0; display:grid; gap:var(--space-2); }
        .upsell-panel__list li { display:flex; flex-wrap:wrap; justify-content:space-between; gap:var(--space-2); padding:var(--space-2); border:1px solid var(--color-line); border-radius:var(--radius-sm); background:#fff; }
        .upsell-panel__list p { margin:var(--space-1) 0 0; color:var(--color-ink-soft); font-size:var(--text-micro); }
        .upsell-panel__status { margin-inline-start:var(--space-2); font-size:var(--text-micro); color:var(--color-sea-deep); }
        .upsell-panel__actions { display:flex; gap:var(--space-2); align-items:flex-start; }
      `}</style>
    </div>
  );
}
