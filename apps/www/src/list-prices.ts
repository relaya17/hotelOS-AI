/**
 * Single source of truth for public list prices (USD worldwide).
 * Keep in sync with apps/www/index.html JSON-LD Offer and PACKAGES copy.
 * Used by scripts/check-www-jsonld.mjs and landing tests.
 */
export const LIST_PRICES_USD = {
  currency: "USD",
  pilot: {
    price: "5000",
    label: "$5,000",
    period: "8 weeks",
  },
  networkMonthlyPerHotel: {
    price: "1000",
    label: "$1,000",
    period: "per hotel / month",
  },
  networkAnnualPerHotel: {
    price: "10800",
    label: "$10,800",
    period: "per hotel / year (−10%)",
  },
  enterpriseAcvFrom: {
    price: "75000",
    label: "$75,000",
    period: "ACV / year (from)",
  },
} as const;
