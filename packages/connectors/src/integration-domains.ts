/**
 * Modular integration domains — HotelOS sits above existing systems.
 * A chain enables only the domains they choose; PMS replacement is never required.
 */
export const INTEGRATION_DOMAINS = [
  {
    id: "pms",
    titleHe: "PMS / הזמנות ומלאי חדרים",
    examples: ["Opera", "Protel", "Fidelio", "Clock PMS", "Mews"],
    status: "adapters",
  },
  {
    id: "channel",
    titleHe: "Channel Manager / OTA inbound",
    examples: ["Channel webhooks → /v1/public/pms/inbound"],
    status: "mvp",
  },
  {
    id: "vms",
    titleHe: "מצלמות / VMS",
    examples: ["Milestone", "Genetec", "generic webhook"],
    status: "mvp",
  },
  {
    id: "reputation",
    titleHe: "ביקורות ומוניטין",
    examples: ["Google", "Booking", "Tripadvisor"],
    status: "mvp",
  },
  {
    id: "payments",
    titleHe: "תשלומים",
    examples: ["external PCI gateway", "stripe_stub", "demo"],
    status: "mvp",
  },
  {
    id: "messaging",
    titleHe: "הודעות אורח / צוות",
    examples: ["WhatsApp", "notification outbox"],
    status: "mvp",
  },
  {
    id: "energy",
    titleHe: "אנרגיה / BMS",
    examples: ["meter webhook → /v1/public/energy/ingest", "occupancy HVAC suggestions"],
    status: "mvp",
  },
  {
    id: "predictive_maintenance",
    titleHe: "תחזוקה חיזויית / חיישנים",
    examples: [
      "sensor webhook → /v1/public/equipment/ingest",
      "history rules + Twin overlay",
    ],
    status: "mvp",
  },
  {
    id: "access",
    titleHe: "מנעולים / mobile key",
    examples: ["Assa Abloy", "Salto", "dormakaba (deferred)"],
    status: "deferred",
  },
] as const;

export type IntegrationDomainId = (typeof INTEGRATION_DOMAINS)[number]["id"];
export type IntegrationDomainStatus =
  (typeof INTEGRATION_DOMAINS)[number]["status"];
