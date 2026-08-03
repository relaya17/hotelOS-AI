import { useState } from "react";
import { Button } from "@hotelos/ui";
import {
  decidePublicGuestUpsell,
  type GuestUpsellOfferDto,
  type GuestStayDto,
} from "@hotelos/web-client";
import { formatCurrency } from "./stay-folio.js";

export type UpsellOffersSectionProps = {
  readonly email: string;
  readonly stay: GuestStayDto;
  readonly onStayUpdated: (stay: GuestStayDto) => void;
};

const offerTypeLabel: Record<GuestUpsellOfferDto["offerType"], string> = {
  room_upgrade: "שדרוג חדר",
  spa: "ספא",
  dinner: "ארוחה",
  late_checkout: "צ׳ק-אאוט מאוחר",
  other: "הצעה",
};

export function UpsellOffersSection({
  email,
  stay,
  onStayUpdated,
}: UpsellOffersSectionProps) {
  const offers = stay.upsellOffers ?? [];
  const [busyId, setBusyId] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [toast, setToast] = useState<string | undefined>();

  if (offers.length === 0) {
    return null;
  }

  async function handleDecision(
    offer: GuestUpsellOfferDto,
    decision: "accepted" | "declined",
  ) {
    setBusyId(offer.id);
    setError(undefined);
    try {
      const updated = await decidePublicGuestUpsell({
        email,
        bookingId: stay.bookingId,
        offerId: offer.id,
        decision,
      });
      const nextOffers = offers.map((item) =>
        item.id === updated.id ? updated : item,
      );
      onStayUpdated({ ...stay, upsellOffers: nextOffers });
      setToast(
        decision === "accepted"
          ? "תודה! הצוות יאשר את ההצעה בקרוב."
          : "ההצעה סומנה כלא רלוונטית.",
      );
    } catch (decideError) {
      setError(
        decideError instanceof Error
          ? decideError.message
          : "לא הצלחנו לעדכן את ההצעה",
      );
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <section className="upsell-section" aria-labelledby="upsell-section-title">
      <h2 id="upsell-section-title">הצעות לשדרוג</h2>
      <p className="upsell-section__intro">
        הצעות מותאמות לשהייה שלכם — אפשר לאשר או לדחות בקליק.
      </p>
      {toast ? (
        <p className="upsell-section__toast" role="status">
          {toast}
        </p>
      ) : null}
      {error ? (
        <p className="upsell-section__error" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="upsell-cards">
        {offers.map((offer) => (
          <li key={offer.id} className="upsell-card">
            <div className="upsell-card__head">
              <span className="upsell-card__type">
                {offerTypeLabel[offer.offerType]}
              </span>
              <strong className="upsell-card__price">
                {formatCurrency(offer.priceAmount, offer.currency)}
              </strong>
            </div>
            <h3>{offer.titleHe}</h3>
            <p>{offer.descriptionHe}</p>
            {offer.status === "suggested" ? (
              <div className="upsell-card__actions">
                <Button
                  type="button"
                  disabled={busyId === offer.id}
                  onClick={() => void handleDecision(offer, "accepted")}
                >
                  {busyId === offer.id ? "…" : "מעניין אותי"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busyId === offer.id}
                  onClick={() => void handleDecision(offer, "declined")}
                >
                  לא עכשיו
                </Button>
              </div>
            ) : (
              <p className="upsell-card__status" role="status">
                {offer.status === "accepted" ? "אושרה" : "נדחתה"}
              </p>
            )}
          </li>
        ))}
      </ul>
      <style>{`
        .upsell-section { display:grid; gap:var(--space-3); margin-top:var(--space-2); }
        .upsell-section h2 { font-size:var(--text-title); margin:0; }
        .upsell-section__intro { margin:0; color:var(--color-ink-soft); max-width:48ch; }
        .upsell-section__toast { margin:0; padding:var(--space-3); border-radius:var(--radius-sm); background:rgb(15 106 92 / 10%); color:var(--color-sea-deep); font-weight:600; }
        .upsell-section__error { margin:0; color:var(--color-danger); }
        .upsell-cards { list-style:none; margin:0; padding:0; display:grid; gap:var(--space-3); grid-template-columns:repeat(auto-fit, minmax(min(100%, 16rem), 1fr)); }
        .upsell-card { display:grid; gap:var(--space-2); padding:var(--space-4); border:1px solid var(--color-line); border-radius:var(--radius-md); background:var(--color-paper-elevated); box-shadow:var(--shadow-soft); }
        .upsell-card__head { display:flex; justify-content:space-between; gap:var(--space-2); align-items:center; }
        .upsell-card__type { font-size:var(--text-micro); font-weight:700; color:var(--color-sea-deep); background:var(--color-sea-soft); padding:.35rem .65rem; border-radius:var(--radius-pill); }
        .upsell-card__price { font-size:1rem; }
        .upsell-card h3 { margin:0; font-size:1.05rem; }
        .upsell-card p { margin:0; color:var(--color-ink-soft); font-size:var(--text-small); }
        .upsell-card__actions { display:flex; flex-wrap:wrap; gap:var(--space-2); margin-top:var(--space-1); }
        .upsell-card__status { margin:0; font-size:var(--text-small); font-weight:600; color:var(--color-ink-soft); }
      `}</style>
    </section>
  );
}
