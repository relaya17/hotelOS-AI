import { authGet, authPost, hotelQuery } from "./core.js";

export type CioRole =
  | "owner"
  | "ceo"
  | "cfo"
  | "reception"
  | "housekeeping"
  | "fb";

export type CioDigestSectionDto = {
  readonly hotelId: string;
  readonly hotelName: string;
  readonly kashrutEnabled: boolean;
  readonly bulletsHe: readonly string[];
  readonly kashrutNoteHe: string | null;
};

export type CioDigestDto = {
  readonly role: CioRole;
  readonly roleLabelHe: string;
  readonly generatedAt: string;
  readonly tenantName: string;
  readonly headlineHe: string;
  readonly sections: readonly CioDigestSectionDto[];
};

export async function fetchCioDigest(role: CioRole): Promise<CioDigestDto> {
  const payload = (await authGet(
    `/v1/ops/cio-digest?role=${encodeURIComponent(role)}`,
  )) as { data: CioDigestDto };
  return payload.data;
}

export type OpsAnomalyDto = {
  readonly fingerprint: string;
  readonly type: string;
  readonly severity: "low" | "medium" | "high" | "urgent";
  readonly hotelId: string | null;
  readonly titleHe: string;
  readonly evidenceHe: string;
  readonly detectedAt: string;
  readonly amountMinor?: number;
  readonly resourceType?: string;
  readonly resourceId?: string;
};

export async function fetchOpsAnomalies(): Promise<readonly OpsAnomalyDto[]> {
  const payload = (await authGet("/v1/ops/anomalies")) as {
    data: readonly OpsAnomalyDto[];
  };
  return payload.data;
}

export type RevenueSuggestionStatus = "suggested" | "approved" | "rejected";

export type RevenueSuggestionDto = {
  readonly id: string;
  readonly tenantId: string;
  readonly hotelId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly currentOccupancyPct: number;
  readonly suggestedDeltaPct: number;
  readonly rationaleHe: string;
  readonly status: RevenueSuggestionStatus;
  readonly decidedByUserId: string | null;
  readonly decidedAt: string | null;
  readonly createdAt: string;
};

export type GenerateRevenueSuggestionsResultDto = {
  readonly hotelId: string;
  readonly hotelName: string;
  readonly generatedAt: string;
  readonly horizonDays: number;
  readonly suggestions: readonly RevenueSuggestionDto[];
};

export async function generateRevenueSuggestions(
  hotelId: string,
  horizonDays?: number,
): Promise<GenerateRevenueSuggestionsResultDto> {
  const payload = (await authPost("/v1/ops/revenue/suggestions/generate", {
    hotelId,
    ...(horizonDays !== undefined ? { horizonDays } : {}),
  })) as { data: GenerateRevenueSuggestionsResultDto };
  return payload.data;
}

export async function fetchRevenueSuggestions(
  hotelId: string,
  status?: RevenueSuggestionStatus,
): Promise<readonly RevenueSuggestionDto[]> {
  const statusQuery =
    status !== undefined ? `&status=${encodeURIComponent(status)}` : "";
  const payload = (await authGet(
    `/v1/ops/revenue/suggestions?${hotelQuery(hotelId)}${statusQuery}`,
  )) as { data: readonly RevenueSuggestionDto[] };
  return payload.data;
}

export async function decideRevenueSuggestion(
  suggestionId: string,
  status: "approved" | "rejected",
): Promise<RevenueSuggestionDto> {
  const payload = (await authPost(
    `/v1/ops/revenue/suggestions/${suggestionId}/decide`,
    { status },
  )) as { data: RevenueSuggestionDto };
  return payload.data;
}

export type EnergySuggestionStatus = "suggested" | "accepted" | "dismissed";

export type EnergySuggestionDto = {
  readonly id: string;
  readonly hotelId: string;
  readonly periodDate: string;
  readonly occupancyPct: number;
  readonly suggestionHe: string;
  readonly estimatedSavingPct: number;
  readonly status: EnergySuggestionStatus;
  readonly createdAt: string;
};

export type GenerateEnergySuggestionsResultDto = {
  readonly hotelId: string;
  readonly hotelName: string;
  readonly periodDate: string;
  readonly generatedAt: string;
  readonly suggestions: readonly EnergySuggestionDto[];
};

export async function generateEnergySuggestions(
  hotelId: string,
): Promise<GenerateEnergySuggestionsResultDto> {
  const payload = (await authPost(
    `/v1/ops/energy/suggestions/generate?${hotelQuery(hotelId)}`,
    {},
  )) as { data: GenerateEnergySuggestionsResultDto };
  return payload.data;
}

export async function fetchEnergySuggestions(
  hotelId: string,
  status?: EnergySuggestionStatus,
): Promise<readonly EnergySuggestionDto[]> {
  const statusQuery =
    status !== undefined ? `&status=${encodeURIComponent(status)}` : "";
  const payload = (await authGet(
    `/v1/ops/energy/suggestions?${hotelQuery(hotelId)}${statusQuery}`,
  )) as { data: readonly EnergySuggestionDto[] };
  return payload.data;
}

export async function decideEnergySuggestion(
  hotelId: string,
  suggestionId: string,
  decision: "accepted" | "dismissed",
): Promise<EnergySuggestionDto> {
  const payload = (await authPost(
    `/v1/ops/energy/suggestions/${suggestionId}/decide?${hotelQuery(hotelId)}`,
    { decision },
  )) as { data: EnergySuggestionDto };
  return payload.data;
}

export type EquipmentAssetCategory = "hvac" | "elevator" | "boiler" | "other";

export type EquipmentAssetDto = {
  readonly id: string;
  readonly tenantId: string;
  readonly hotelId: string;
  readonly code: string;
  readonly nameHe: string;
  readonly category: EquipmentAssetCategory;
  readonly locationHe: string;
  readonly installDate: string | null;
  readonly createdAt: string;
};

export type MaintenancePredictionStatus =
  | "open"
  | "acknowledged"
  | "dismissed"
  | "converted";

export type MaintenancePredictionDto = {
  readonly id: string;
  readonly tenantId: string;
  readonly hotelId: string;
  readonly assetId: string;
  readonly riskScore: number;
  readonly rationaleHe: string;
  readonly recommendedActionHe: string;
  readonly status: MaintenancePredictionStatus;
  readonly taskId: string | null;
  readonly createdAt: string;
};

export type PredictiveMaintenanceScanDto = {
  readonly hotelId: string;
  readonly predictionCount: number;
  readonly tasksCreated: number;
  readonly predictions: readonly MaintenancePredictionDto[];
};

export async function fetchEquipmentAssets(
  hotelId: string,
): Promise<readonly EquipmentAssetDto[]> {
  const payload = (await authGet(
    `/v1/ops/equipment/assets?${hotelQuery(hotelId)}`,
  )) as { data: readonly EquipmentAssetDto[] };
  return payload.data;
}

export async function createEquipmentAsset(
  hotelId: string,
  input: {
    readonly code: string;
    readonly nameHe: string;
    readonly category: EquipmentAssetCategory;
    readonly locationHe: string;
    readonly installDate?: string;
  },
): Promise<EquipmentAssetDto> {
  const payload = (await authPost(
    `/v1/ops/equipment/assets?${hotelQuery(hotelId)}`,
    input,
  )) as { data: EquipmentAssetDto };
  return payload.data;
}

export async function runPredictiveMaintenanceScan(
  hotelId: string,
): Promise<PredictiveMaintenanceScanDto> {
  const payload = (await authPost(
    `/v1/ops/equipment/scan?${hotelQuery(hotelId)}`,
    {},
  )) as { data: PredictiveMaintenanceScanDto };
  return payload.data;
}

export async function fetchMaintenancePredictions(
  hotelId: string,
  status?: MaintenancePredictionStatus,
): Promise<readonly MaintenancePredictionDto[]> {
  const statusQuery =
    status !== undefined ? `&status=${encodeURIComponent(status)}` : "";
  const payload = (await authGet(
    `/v1/ops/equipment/predictions?${hotelQuery(hotelId)}${statusQuery}`,
  )) as { data: readonly MaintenancePredictionDto[] };
  return payload.data;
}

export async function decideMaintenancePrediction(
  hotelId: string,
  predictionId: string,
  status: "acknowledged" | "dismissed" | "converted",
): Promise<MaintenancePredictionDto> {
  const payload = (await authPost(
    `/v1/ops/equipment/predictions/${predictionId}/decide?${hotelQuery(hotelId)}`,
    { status },
  )) as { data: MaintenancePredictionDto };
  return payload.data;
}

export type OpsForecastDayDto = {
  readonly date: string;
  readonly arrivalsCount: number;
  readonly departuresCount: number;
  readonly occupancyEstimatePct: number;
  readonly openMaintenanceCount: number;
  readonly staffingHintHe: string;
};

export type OpsForecastDto = {
  readonly hotelId: string;
  readonly hotelName: string;
  readonly generatedAt: string;
  readonly days: readonly OpsForecastDayDto[];
  readonly summaryBulletsHe: readonly string[];
};

export async function fetchOpsForecast(hotelId: string): Promise<OpsForecastDto> {
  const payload = (await authGet(
    `/v1/ops/forecast?${hotelQuery(hotelId)}`,
  )) as { data: OpsForecastDto };
  return payload.data;
}

export type IncidentSeverity = "low" | "medium" | "high" | "urgent";
export type IncidentDepartment = "security" | "it" | "maintenance";

export type IncidentDto = {
  readonly id: string;
  readonly hotelId: string;
  readonly hotelName: string;
  readonly department: IncidentDepartment;
  readonly severity: IncidentSeverity;
  readonly title: string;
  readonly source: string;
  readonly createdAt: string;
  readonly status: string;
  readonly taskId: string | null;
};

export type IncidentCenterDto = {
  readonly generatedAt: string;
  readonly incidents: readonly IncidentDto[];
};

export async function fetchIncidentCenter(
  hotelId?: string,
): Promise<IncidentCenterDto> {
  const query =
    hotelId !== undefined && hotelId.length > 0
      ? `?hotelId=${encodeURIComponent(hotelId)}`
      : "";
  const payload = (await authGet(`/v1/ops/incidents${query}`)) as {
    data: IncidentCenterDto;
  };
  return payload.data;
}

export type PilotRoiMetricsDto = {
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

export async function fetchPilotRoiMetrics(input?: {
  readonly hotelId?: string;
  readonly windowDays?: number;
}): Promise<PilotRoiMetricsDto> {
  const params = new URLSearchParams();
  if (input?.hotelId) {
    params.set("hotelId", input.hotelId);
  }
  if (input?.windowDays !== undefined) {
    params.set("windowDays", String(input.windowDays));
  }
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const payload = (await authGet(`/v1/ops/pilot-roi${query}`)) as {
    data: PilotRoiMetricsDto;
  };
  return payload.data;
}

export type SynthesizedCioDigestDto = {
  readonly digest: CioDigestDto;
  readonly narrativeHe: string;
  readonly suggestedActionsHe: readonly string[];
  readonly citations: readonly {
    readonly title: string;
    readonly url?: string;
    readonly source: "internal" | "trusted" | "company";
    readonly snippet?: string;
  }[];
  readonly provider: string;
  readonly confidence: string;
  readonly latencyMs: number;
  readonly requiresHumanApproval: boolean;
  readonly approvalReasonHe: string | null;
};

export async function synthesizeCioDigest(
  role: CioRole = "ceo",
): Promise<SynthesizedCioDigestDto> {
  const payload = (await authPost("/v1/ops/cio-digest/synthesize", {
    role,
  })) as { data: SynthesizedCioDigestDto };
  return payload.data;
}

export type FinanceDoctorAudience =
  | "owner"
  | "ceo"
  | "cfo"
  | "gm"
  | "procurement";
export type FinanceDoctorFocus =
  | "all"
  | "finance"
  | "procurement"
  | "marketing"
  | "investment";

export type CfoFinanceBriefDto = {
  readonly generatedAt: string;
  readonly tenantName: string;
  readonly headlineHe: string;
  readonly hotels: readonly { readonly id: string; readonly name: string }[];
  readonly hotelBulletsHe: readonly string[];
  readonly ledgerSummaryHe: readonly string[];
  readonly procurementBulletsHe: readonly string[];
  readonly marketingBulletsHe: readonly string[];
  readonly guestMemoryBulletsHe: readonly string[];
  readonly anomalyBulletsHe: readonly string[];
  readonly marketSourcesHe: readonly string[];
  readonly marketSnapshotsHe: readonly string[];
  readonly guardrailHe: string;
};

export type SynthesizedCfoFinanceBriefDto = {
  readonly brief: CfoFinanceBriefDto;
  readonly audience: FinanceDoctorAudience;
  readonly focus: FinanceDoctorFocus;
  readonly agentId: string;
  readonly narrativeHe: string;
  readonly suggestedActionsHe: readonly string[];
  readonly citations: readonly {
    readonly title: string;
    readonly url?: string;
    readonly source: "internal" | "trusted" | "company";
    readonly snippet?: string;
  }[];
  readonly provider: string;
  readonly confidence: string;
  readonly latencyMs: number;
  readonly requiresHumanApproval: boolean;
  readonly approvalReasonHe: string | null;
};

export type TrustedSourceSnapshotDto = {
  readonly id: string;
  readonly sourceId: string;
  readonly fetchedAt: string;
  readonly title: string;
  readonly summary: string;
  readonly status: "ok" | "failed";
  readonly error: string | null;
  readonly hasEmbedding: boolean;
  readonly embeddedAt: string | null;
  readonly embeddingModel: string | null;
};

export async function fetchCfoFinanceBrief(): Promise<CfoFinanceBriefDto> {
  const payload = (await authGet("/v1/ops/cfo-finance-brief")) as {
    data: CfoFinanceBriefDto;
  };
  return payload.data;
}

export async function synthesizeCfoFinanceBrief(input?: {
  readonly questionHe?: string;
  readonly audience?: FinanceDoctorAudience;
  readonly focus?: FinanceDoctorFocus;
}): Promise<SynthesizedCfoFinanceBriefDto> {
  const payload = (await authPost(
    "/v1/ops/cfo-finance-brief/synthesize",
    input ?? {},
  )) as { data: SynthesizedCfoFinanceBriefDto };
  return payload.data;
}

export async function refreshCfoMarketFeeds(): Promise<{
  readonly attempted: number;
  readonly ok: number;
  readonly failed: number;
}> {
  const payload = (await authPost(
    "/v1/ops/cfo-finance-brief/refresh-feeds",
    {},
  )) as {
    data: {
      attempted: number;
      ok: number;
      failed: number;
    };
  };
  return payload.data;
}

export async function fetchCfoMarketSnapshots(): Promise<
  readonly TrustedSourceSnapshotDto[]
> {
  const payload = (await authGet("/v1/ops/cfo-finance-brief/snapshots")) as {
    data: readonly TrustedSourceSnapshotDto[];
  };
  return payload.data;
}

export type OrgCommsChannelDto = {
  readonly id: string;
  readonly tenantId: string;
  readonly chainId: string;
  readonly hotelId: string | null;
  readonly channelKey: string;
  readonly nameHe: string;
  readonly createdAt: string;
};

export type OrgCommsMessageDto = {
  readonly id: string;
  readonly channelId: string;
  readonly fromRole: string;
  readonly body: string;
  readonly createdByUserId: string | null;
  readonly createdAt: string;
};

export async function listOrgCommsChannels(): Promise<
  readonly OrgCommsChannelDto[]
> {
  const payload = (await authGet("/v1/org-comms/channels")) as {
    data: OrgCommsChannelDto[];
  };
  return payload.data;
}

export async function listOrgCommsMessages(
  channelId: string,
): Promise<readonly OrgCommsMessageDto[]> {
  const payload = (await authGet(
    `/v1/org-comms/channels/${channelId}/messages`,
  )) as { data: OrgCommsMessageDto[] };
  return payload.data;
}

export async function postOrgCommsMessage(
  channelId: string,
  input: { fromRole: string; body: string },
): Promise<OrgCommsMessageDto> {
  const payload = (await authPost(
    `/v1/org-comms/channels/${channelId}/messages`,
    input,
  )) as { data: OrgCommsMessageDto };
  return payload.data;
}

export type TrustedSourceCategory =
  | "regulator"
  | "university"
  | "market_data"
  | "accounting_standard"
  | "kashrut_authority"
  | "other";

export type TrustedSourceDto = {
  readonly id: string;
  readonly tenantId: string;
  readonly title: string;
  readonly url: string;
  readonly category: string;
  readonly approvedAt: string;
  readonly approvedByUserId: string | null;
  readonly createdAt: string;
};

export async function listTrustedSources(): Promise<
  readonly TrustedSourceDto[]
> {
  const payload = (await authGet("/v1/knowledge/trusted-sources")) as {
    data: TrustedSourceDto[];
  };
  return payload.data;
}

export async function createTrustedSource(input: {
  title: string;
  url: string;
  category: TrustedSourceCategory;
}): Promise<TrustedSourceDto> {
  const payload = (await authPost(
    "/v1/knowledge/trusted-sources",
    input,
  )) as { data: TrustedSourceDto };
  return payload.data;
}

export type KashrutTargetKind =
  | "procurement"
  | "menu"
  | "briefing"
  | "event"
  | "other";
export type KashrutStatus = "ok" | "note" | "warn" | "block";

export type KashrutAnnotationDto = {
  readonly id: string;
  readonly tenantId: string;
  readonly hotelId: string;
  readonly targetKind: KashrutTargetKind;
  readonly targetId: string;
  readonly status: KashrutStatus;
  readonly message: string | null;
  readonly createdByUserId: string | null;
  readonly createdAt: string;
};

export async function fetchKashrutAnnotations(
  hotelId: string,
  targetKind?: KashrutTargetKind,
): Promise<{
  readonly kashrutEnabled: boolean;
  readonly annotations: readonly KashrutAnnotationDto[];
}> {
  const query = new URLSearchParams({ hotelId });
  if (targetKind) query.set("targetKind", targetKind);
  const payload = (await authGet(
    `/v1/kashrut/annotations?${query.toString()}`,
  )) as {
    data: { kashrutEnabled: boolean; annotations: KashrutAnnotationDto[] };
  };
  return payload.data;
}

export async function createKashrutAnnotation(
  hotelId: string,
  input: {
    targetKind: KashrutTargetKind;
    targetId: string;
    status: KashrutStatus;
    message?: string;
  },
): Promise<KashrutAnnotationDto> {
  const payload = (await authPost(
    `/v1/kashrut/annotations?${hotelQuery(hotelId)}`,
    input,
  )) as { data: KashrutAnnotationDto };
  return payload.data;
}
