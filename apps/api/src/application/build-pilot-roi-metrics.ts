import type {
  BookingRepository,
  BriefingRepository,
  HotelRepository,
  OpsRepository,
  PersistedBriefingRoom,
  PersistedDepartmentTask,
  PersistedReputationReview,
  PersistedUpsellOffer,
  ReputationRepository,
  RevenueSuggestionsRepository,
  UpsellRepository,
} from "@hotelos/database";
import type { HotelId, TenantId } from "@hotelos/shared";

export type PilotRoiMetrics = {
  readonly generatedAt: string;
  readonly windowDays: number;
  readonly windowStart: string;
  readonly hotelId: string | null;
  readonly hotelName: string | null;
  readonly morningBriefingProxy: number;
  readonly medianIncidentHandleHours: number | null;
  readonly roomPrepMedianMinutes: number | null;
  readonly autoTasksCreated: number;
  readonly upsellAcceptedCount: number;
  readonly upsellAcceptedRate: number | null;
  readonly negativeReviewResponseHours: number | null;
  readonly revenueSuggestionApprovedRate: number | null;
  readonly notesHe: readonly string[];
};

export type BuildPilotRoiMetricsDeps = {
  readonly hotels: HotelRepository;
  readonly briefing: BriefingRepository;
  readonly ops: OpsRepository;
  readonly bookings: BookingRepository;
  readonly upsells: UpsellRepository;
  readonly reputation: ReputationRepository;
  readonly revenueSuggestions: RevenueSuggestionsRepository;
};

export type BuildPilotRoiMetricsInput = {
  readonly tenantId: TenantId;
  readonly hotelId?: HotelId;
  readonly windowDays?: number;
  readonly now?: Date;
};

const WINDOW_DAYS_DEFAULT = 30;

const INCIDENT_DEPARTMENT_CODES = [
  "security",
  "it",
  "maintenance",
] as const;

const INCIDENT_TASK_TYPES = new Set([
  "security_event",
  "error_event",
  "anomaly_alert",
  "critical_maintenance",
  "incident",
  "safety_event",
]);

const AUTO_TASK_TYPES = new Set([
  "reputation_review",
  "anomaly_alert",
  "security_event",
  "error_event",
]);

const BRIEFING_KEYWORDS = [
  "briefing",
  "digest",
  "cio",
  "תדריך",
  "בוקר",
  "meet",
] as const;

function parseIso(iso: string): number {
  return new Date(iso).getTime();
}

function isOnOrAfter(iso: string, windowStartMs: number): boolean {
  return parseIso(iso) >= windowStartMs;
}

function hoursBetween(startIso: string, endIso: string): number {
  return (parseIso(endIso) - parseIso(startIso)) / (1000 * 60 * 60);
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function matchesBriefingProxy(room: PersistedBriefingRoom): boolean {
  if (room.status !== "ended") {
    return false;
  }
  const haystack = `${room.title} ${room.purpose}`.toLowerCase();
  return BRIEFING_KEYWORDS.some((keyword) =>
    haystack.includes(keyword.toLowerCase()),
  );
}

function isIncidentTask(task: PersistedDepartmentTask): boolean {
  return INCIDENT_TASK_TYPES.has(task.taskType);
}

function isAutoTask(task: PersistedDepartmentTask): boolean {
  return AUTO_TASK_TYPES.has(task.taskType);
}

async function listHotelTasks(
  deps: BuildPilotRoiMetricsDeps,
  tenantId: TenantId,
  hotelId: HotelId,
): Promise<readonly PersistedDepartmentTask[]> {
  await deps.ops.ensureStandardDepartments(
    tenantId,
    hotelId,
    new Date().toISOString(),
  );
  const departments = await deps.ops.listDepartments(tenantId, hotelId);
  const tasks: PersistedDepartmentTask[] = [];
  for (const dept of departments) {
    const deptTasks = await deps.ops.listTasksByDepartment(
      tenantId,
      hotelId,
      dept.id,
    );
    tasks.push(...deptTasks);
  }
  return tasks;
}

function incidentHandleHours(task: PersistedDepartmentTask): number | null {
  if (task.status !== "done") {
    return null;
  }
  const endIso = task.updatedAt;
  if (!endIso || parseIso(endIso) <= parseIso(task.createdAt)) {
    return null;
  }
  return hoursBetween(task.createdAt, endIso);
}

function reviewResponseHours(
  review: PersistedReputationReview,
  tasksById: ReadonlyMap<string, PersistedDepartmentTask>,
): number | null {
  if (review.sentiment !== "negative" || !review.taskId) {
    return null;
  }
  const task = tasksById.get(review.taskId);
  if (!task || task.status !== "done") {
    return null;
  }
  const endIso = task.updatedAt;
  if (parseIso(endIso) <= parseIso(review.reviewedAt)) {
    return null;
  }
  return hoursBetween(review.reviewedAt, endIso);
}

function upsellMetricsInWindow(
  offers: readonly PersistedUpsellOffer[],
  windowStartMs: number,
): { readonly acceptedCount: number; readonly acceptedRate: number | null } {
  const inWindow = offers.filter((offer) =>
    isOnOrAfter(offer.suggestedAt, windowStartMs),
  );
  const acceptedCount = inWindow.filter(
    (offer) => offer.status === "accepted",
  ).length;
  const decidedCount = inWindow.filter(
    (offer) => offer.status === "accepted" || offer.status === "declined",
  ).length;
  const acceptedRate =
    decidedCount > 0 ? round1(acceptedCount / decidedCount) : null;
  return { acceptedCount, acceptedRate };
}

function revenueSuggestionMetricsInWindow(
  suggestions: readonly {
    readonly status: string;
    readonly decidedAt: string | null;
    readonly createdAt: string;
  }[],
  windowStartMs: number,
): number | null {
  const decided = suggestions.filter((row) => {
    if (row.status !== "approved" && row.status !== "rejected") {
      return false;
    }
    const anchor = row.decidedAt ?? row.createdAt;
    return isOnOrAfter(anchor, windowStartMs);
  });
  if (decided.length === 0) {
    return null;
  }
  const approved = decided.filter((row) => row.status === "approved").length;
  return round1(approved / decided.length);
}

/**
 * Live operational metrics for the pilot ROI scorecard — current period only.
 * Baseline comparison stays manual in docs/planning/pilot-roi-scorecard.md.
 */
export async function buildPilotRoiMetrics(
  deps: BuildPilotRoiMetricsDeps,
  input: BuildPilotRoiMetricsInput,
): Promise<PilotRoiMetrics | null> {
  const windowDays = input.windowDays ?? WINDOW_DAYS_DEFAULT;
  const now = input.now ?? new Date();
  const windowStart = new Date(now);
  windowStart.setUTCDate(windowStart.getUTCDate() - windowDays);
  const windowStartMs = windowStart.getTime();
  const windowStartIso = windowStart.toISOString();
  const notesHe: string[] = [];

  const tenantHotels = await deps.hotels.listByTenant(input.tenantId);
  if (tenantHotels.length === 0) {
    return null;
  }

  let scopedHotels = tenantHotels;
  if (input.hotelId) {
    const hotel = tenantHotels.find((row) => row.id === input.hotelId);
    if (!hotel) {
      return null;
    }
    scopedHotels = [hotel];
  }

  notesHe.push(
    "מדדי תקופה נוכחית בלבד — השוואה ל-baseline (שבוע 0) מתבצעת ידנית בגיליון הפיילוט.",
  );
  notesHe.push(
    "morningBriefingProxy: מספר חדרי Meet/CIO digest שהסתיימו — פרוקסי לתדריך בוקר (לא משך דקות).",
  );

  const briefingRooms = await deps.briefing.listByTenant(input.tenantId);
  const morningBriefingProxy = briefingRooms.filter(
    (room) =>
      matchesBriefingProxy(room) &&
      isOnOrAfter(room.createdAt, windowStartMs),
  ).length;

  const incidentHandleHoursList: number[] = [];
  let autoTasksCreated = 0;
  const negativeReviewHours: number[] = [];
  let upsellAcceptedCount = 0;
  let upsellDecidedCount = 0;
  let roomPrepSamples = 0;
  const revenueSuggestionRates: number[] = [];

  for (const hotel of scopedHotels) {
    const hotelId = hotel.id;
    const tasks = await listHotelTasks(deps, input.tenantId, hotelId);

    const tasksById = new Map(tasks.map((task) => [task.id, task]));

    for (const code of INCIDENT_DEPARTMENT_CODES) {
      const dept = await deps.ops.findDepartmentByCode(
        input.tenantId,
        hotelId,
        code,
      );
      if (!dept) {
        continue;
      }
      const deptTasks = tasks.filter(
        (task) => task.departmentId === dept.id && isIncidentTask(task),
      );
      for (const task of deptTasks) {
        if (
          task.status === "done" &&
          isOnOrAfter(task.updatedAt, windowStartMs)
        ) {
          const hours = incidentHandleHours(task);
          if (hours !== null && hours >= 0) {
            incidentHandleHoursList.push(hours);
          }
        }
      }
    }

    autoTasksCreated += tasks.filter(
      (task) =>
        isAutoTask(task) && isOnOrAfter(task.createdAt, windowStartMs),
    ).length;

    const reviews = await deps.reputation.listByHotel(input.tenantId, hotelId);
    for (const review of reviews) {
      if (!isOnOrAfter(review.reviewedAt, windowStartMs)) {
        continue;
      }
      const hours = reviewResponseHours(review, tasksById);
      if (hours !== null && hours >= 0) {
        negativeReviewHours.push(hours);
      }
    }

    const offers = await deps.upsells.listByHotel(input.tenantId, hotelId);
    const upsell = upsellMetricsInWindow(offers, windowStartMs);
    upsellAcceptedCount += upsell.acceptedCount;
    upsellDecidedCount += offers.filter(
      (offer) =>
        isOnOrAfter(offer.suggestedAt, windowStartMs) &&
        (offer.status === "accepted" || offer.status === "declined"),
    ).length;

    const hotelBookings = await deps.bookings.listByHotel(
      input.tenantId,
      hotelId,
    );
    roomPrepSamples += hotelBookings.filter(
      (booking) => booking.roomPrepStatus !== null,
    ).length;

    const suggestions = await deps.revenueSuggestions.listByHotel(
      input.tenantId,
      hotelId,
    );
    const hotelRate = revenueSuggestionMetricsInWindow(
      suggestions,
      windowStartMs,
    );
    if (hotelRate !== null) {
      revenueSuggestionRates.push(hotelRate);
    }
  }

  const upsellAcceptedRate =
    upsellDecidedCount > 0
      ? round1(upsellAcceptedCount / upsellDecidedCount)
      : null;

  const medianIncidentHandleHours =
    incidentHandleHoursList.length > 0
      ? round1(median(incidentHandleHoursList)!)
      : null;
  if (medianIncidentHandleHours === null) {
    notesHe.push(
      "medianIncidentHandleHours: אין תקלות incident שהושלמו בחלון — null.",
    );
  } else if (incidentHandleHoursList.some((hours) => hours > 0)) {
    notesHe.push(
      "medianIncidentHandleHours: חישוב לפי createdAt→updatedAt (heuristic כשאין closedAt מפורש).",
    );
  }

  const roomPrepMedianMinutes: number | null = null;
  notesHe.push(
    "roomPrepMedianMinutes: אין חותמות waiting→ready ב-bookings — null (נדרש שדות זמן עתידיים).",
  );
  if (roomPrepSamples > 0) {
    notesHe.push(
      `${roomPrepSamples} הזמנות עם room_prep_status — ללא timestamps לחישוב מedian.`,
    );
  }

  const negativeReviewResponseHours =
    negativeReviewHours.length > 0
      ? round1(median(negativeReviewHours)!)
      : null;
  if (negativeReviewResponseHours === null) {
    notesHe.push(
      "negativeReviewResponseHours: אין ביקורות שליליות עם משימה front_office שהושלמה — null.",
    );
  }

  if (upsellAcceptedCount === 0 && upsellAcceptedRate === null) {
    notesHe.push("upsell: אין הצעות upsell עם החלטה בחלון — שיעור null.");
  }

  const revenueSuggestionApprovedRate =
    revenueSuggestionRates.length === 1
      ? revenueSuggestionRates[0]!
      : revenueSuggestionRates.length > 1
        ? round1(
            revenueSuggestionRates.reduce((sum, rate) => sum + rate, 0) /
              revenueSuggestionRates.length,
          )
        : null;
  if (revenueSuggestionApprovedRate === null) {
    notesHe.push(
      "revenueSuggestionApprovedRate: אין revenue_suggestions עם approved/rejected בחלון — null.",
    );
  }

  const primaryHotel = scopedHotels.length === 1 ? scopedHotels[0]! : null;

  return {
    generatedAt: now.toISOString(),
    windowDays,
    windowStart: windowStartIso,
    hotelId: primaryHotel?.id ?? null,
    hotelName: primaryHotel?.name ?? null,
    morningBriefingProxy,
    medianIncidentHandleHours,
    roomPrepMedianMinutes,
    autoTasksCreated,
    upsellAcceptedCount,
    upsellAcceptedRate,
    negativeReviewResponseHours,
    revenueSuggestionApprovedRate,
    notesHe,
  };
}
