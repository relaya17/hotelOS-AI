import type { PilotRoiMetricsDto } from "@hotelos/web-client";

export type PilotRoiMetricId =
  | "morning-briefing"
  | "incident-median"
  | "room-prep"
  | "manual-coordination"
  | "upsell-revenue"
  | "negative-review"
  | "revenue-suggestion-approval";

export type MetricDirection = "lower" | "higher" | "neutral";

export type ScorecardMetricDef = {
  readonly id: PilotRoiMetricId;
  readonly row: number;
  readonly labelHe: string;
  readonly targetHe: string;
  readonly direction: MetricDirection;
  readonly staticNotesHe: string;
  readonly baselinePlaceholder: string;
};

export const SCORECARD_DOC =
  "https://github.com/hotelos/hotel/blob/main/docs/planning/pilot-roi-scorecard.md";

export const PILOT_ROI_BASELINE_PREFIX = "hotelos:pilot-roi:baseline:";
export const PILOT_ROI_NOTES_PREFIX = "hotelos:pilot-roi:notes:";

export const SCORECARD_METRICS: readonly ScorecardMetricDef[] = [
  {
    id: "morning-briefing",
    row: 1,
    labelHe: "משך תדריך בוקר (דק׳) — פרוקסי: חדרי Meet/CIO שהסתיימו",
    targetHe: "−70%",
    direction: "lower",
    staticNotesHe:
      "נוכחי = מספר חדרים, לא דקות — השוו baseline ידני מגיליון הפיילוט.",
    baselinePlaceholder: "להזנה בפיילוט (דק׳)",
  },
  {
    id: "incident-median",
    row: 2,
    labelHe: "זמן חציוני לטיפול בתקלה דחופה (שע׳)",
    targetHe: "−30–50%",
    direction: "lower",
    staticNotesHe: "Incident Center · משימות שהושלמו.",
    baselinePlaceholder: "להזנה בפיילוט (שע׳)",
  },
  {
    id: "room-prep",
    row: 3,
    labelHe: "ממוצע דק׳ ניקיון חדר (waiting→ready)",
    targetHe: "שיפור ברור",
    direction: "lower",
    staticNotesHe:
      "אין חותמות waiting→ready — null עד שדות זמן יתווספו ל-bookings.",
    baselinePlaceholder: "להזנה בפיילוט (דק׳)",
  },
  {
    id: "manual-coordination",
    row: 4,
    labelHe: "שעות הנהלה/קבלה על תיאום ידני / שבוע",
    targetHe: "−עומס",
    direction: "lower",
    staticNotesHe:
      "לא נמדד במערכת — baseline ידני בלבד. פרוקסי קשור: משימות אוטומטיות (שורה נפרדת ב-API).",
    baselinePlaceholder: "להזנה בפיילוט (שע׳/שבוע)",
  },
  {
    id: "upsell-revenue",
    row: 5,
    labelHe: "הכנסות שירותים נלווים / שבוע (₪)",
    targetHe: "עלייה",
    direction: "higher",
    staticNotesHe:
      "נוכחי = מספר upsell שאושרו (לא ₪) — סכום כספי: baseline ידני עד חיבור PMS/מחירים.",
    baselinePlaceholder: "להזנה בפיילוט (₪/שבוע)",
  },
  {
    id: "negative-review",
    row: 6,
    labelHe: "זמן תגובה לביקורת שלילית (שע׳)",
    targetHe: "<24ש׳",
    direction: "lower",
    staticNotesHe: "Reputation → משימת front_office שהושלמה.",
    baselinePlaceholder: "להזנה בפיילוט (שע׳)",
  },
  {
    id: "revenue-suggestion-approval",
    row: 7,
    labelHe: "% הצעות תמחור שאושרו (HITL, revenue_suggestions)",
    targetHe: "תהליך חי",
    direction: "higher",
    staticNotesHe: "CIO digest · revenue_suggestions — ללא כתיבה ל-PMS.",
    baselinePlaceholder: "להזנה בפיילוט (%)",
  },
];

export type MetricCurrentValue = {
  readonly display: string;
  readonly numeric: number | null;
  readonly unit: string;
};

function formatNullableNumber(
  value: number | null,
  fractionDigits = 1,
): string {
  if (value === null) {
    return "—";
  }
  return value.toLocaleString("he-IL", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  });
}

function formatRate(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return `${Math.round(value * 100)}%`;
}

export function readPilotRoiBaseline(
  hotelId: string,
  metricId: PilotRoiMetricId,
): string {
  try {
    return (
      localStorage.getItem(`${PILOT_ROI_BASELINE_PREFIX}${hotelId}:${metricId}`) ??
      ""
    );
  } catch {
    return "";
  }
}

export function writePilotRoiBaseline(
  hotelId: string,
  metricId: PilotRoiMetricId,
  value: string,
): void {
  try {
    const key = `${PILOT_ROI_BASELINE_PREFIX}${hotelId}:${metricId}`;
    if (value.trim().length === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // ignore quota / private mode
  }
}

export function readPilotRoiNotes(
  hotelId: string,
  metricId: PilotRoiMetricId,
): string {
  try {
    return (
      localStorage.getItem(`${PILOT_ROI_NOTES_PREFIX}${hotelId}:${metricId}`) ??
      ""
    );
  } catch {
    return "";
  }
}

export function writePilotRoiNotes(
  hotelId: string,
  metricId: PilotRoiMetricId,
  value: string,
): void {
  try {
    const key = `${PILOT_ROI_NOTES_PREFIX}${hotelId}:${metricId}`;
    if (value.trim().length === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // ignore
  }
}

export function parseBaselineNumber(raw: string): number | null {
  const trimmed = raw.trim().replace(/%/g, "").replace(/,/g, "");
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export type MetricDelta = {
  readonly absolute: number;
  readonly percent: number | null;
  readonly improved: boolean;
  readonly displayAbsolute: string;
  readonly displayPercent: string | null;
};

export function computeMetricDelta(input: {
  readonly current: number | null;
  readonly baselineRaw: string;
  readonly direction: MetricDirection;
  readonly fractionDigits?: number;
}): MetricDelta | null {
  const baseline = parseBaselineNumber(input.baselineRaw);
  if (baseline === null || input.current === null) {
    return null;
  }
  const rawDelta = input.current - baseline;
  const improved =
    input.direction === "lower"
      ? rawDelta < 0
      : input.direction === "higher"
        ? rawDelta > 0
        : rawDelta !== 0;
  const signedDelta =
    input.direction === "lower" ? baseline - input.current : rawDelta;
  const fractionDigits = input.fractionDigits ?? 1;
  const displayAbsolute = `${signedDelta >= 0 ? "+" : ""}${signedDelta.toLocaleString("he-IL", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  })}`;
  const percent =
    baseline !== 0 ? Math.round((rawDelta / baseline) * 1000) / 10 : null;
  return {
    absolute: signedDelta,
    percent,
    improved,
    displayAbsolute,
    displayPercent:
      percent === null
        ? null
        : `${percent >= 0 ? "+" : ""}${percent.toLocaleString("he-IL")}%`,
  };
}

export function metricCurrentValue(
  metrics: PilotRoiMetricsDto,
  id: PilotRoiMetricId,
): MetricCurrentValue {
  switch (id) {
    case "morning-briefing":
      return {
        display: String(metrics.morningBriefingProxy),
        numeric: metrics.morningBriefingProxy,
        unit: "חדרים (פרוקסי)",
      };
    case "incident-median":
      return {
        display: formatNullableNumber(metrics.medianIncidentHandleHours),
        numeric: metrics.medianIncidentHandleHours,
        unit: "שעות",
      };
    case "room-prep":
      return {
        display: formatNullableNumber(metrics.roomPrepMedianMinutes, 0),
        numeric: metrics.roomPrepMedianMinutes,
        unit: "דקות",
      };
    case "manual-coordination":
      return {
        display: "—",
        numeric: null,
        unit: "שע׳/שבוע",
      };
    case "upsell-revenue":
      return {
        display: String(metrics.upsellAcceptedCount),
        numeric: metrics.upsellAcceptedCount,
        unit: `אושרו · ${formatRate(metrics.upsellAcceptedRate)} (לא ₪)`,
      };
    case "negative-review":
      return {
        display: formatNullableNumber(metrics.negativeReviewResponseHours),
        numeric: metrics.negativeReviewResponseHours,
        unit: "שעות",
      };
    case "revenue-suggestion-approval":
      return {
        display: formatRate(metrics.revenueSuggestionApprovedRate),
        numeric:
          metrics.revenueSuggestionApprovedRate === null
            ? null
            : metrics.revenueSuggestionApprovedRate * 100,
        unit: "%",
      };
  }
}
