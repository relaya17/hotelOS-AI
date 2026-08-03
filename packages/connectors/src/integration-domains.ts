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

const INTEGRATION_DOMAIN_IDS = new Set<IntegrationDomainId>(
  INTEGRATION_DOMAINS.map((domain) => domain.id),
);

/** Sensible pilot default when hotel explicitly saves an empty enabled list. */
export const DEFAULT_PILOT_INTEGRATION_DOMAIN_IDS = [
  "pms",
  "predictive_maintenance",
  "reputation",
] as const satisfies readonly IntegrationDomainId[];

/** Non-deferred domains — used when `enabled_integration_domains` is null (never configured). */
export const ALL_PILOT_INTEGRATION_DOMAIN_IDS = INTEGRATION_DOMAINS.filter(
  (domain) => domain.status !== "deferred",
).map((domain) => domain.id);

export function isIntegrationDomainId(
  value: string,
): value is IntegrationDomainId {
  return INTEGRATION_DOMAIN_IDS.has(value as IntegrationDomainId);
}

export function isConfigurableIntegrationDomainId(
  value: string,
): value is IntegrationDomainId {
  if (!isIntegrationDomainId(value)) {
    return false;
  }
  const domain = INTEGRATION_DOMAINS.find((row) => row.id === value);
  return domain !== undefined && domain.status !== "deferred";
}

/**
 * Resolve hotel preference JSON to enabled domain ids.
 * - null/undefined (column never set): all non-deferred domains
 * - `[]` (explicit empty): DEFAULT_PILOT_INTEGRATION_DOMAIN_IDS
 */
export function resolveEnabledIntegrationDomains(
  stored: string | null | undefined,
): readonly IntegrationDomainId[] {
  if (stored === null || stored === undefined) {
    return ALL_PILOT_INTEGRATION_DOMAIN_IDS;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return [...DEFAULT_PILOT_INTEGRATION_DOMAIN_IDS];
  }
  if (!Array.isArray(parsed)) {
    return [...DEFAULT_PILOT_INTEGRATION_DOMAIN_IDS];
  }
  if (parsed.length === 0) {
    return [...DEFAULT_PILOT_INTEGRATION_DOMAIN_IDS];
  }
  return parsed.filter(
    (id): id is IntegrationDomainId =>
      typeof id === "string" && isIntegrationDomainId(id),
  );
}
