import {
  authGet,
  authPatch,
  authPost,
  getApiBase,
  hotelQuery,
  parseJson,
  toErrorMessage,
} from "./core.js";

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "open" | "in_progress" | "blocked" | "done" | "cancelled";

export type DepartmentSummaryDto = {
  readonly id: string;
  readonly hotelId: string;
  readonly code: string;
  readonly name: string;
};

export type DepartmentDto = DepartmentSummaryDto & { readonly staffCount: number };

export type DepartmentTaskDto = {
  readonly id: string;
  readonly tenantId: string;
  readonly hotelId: string;
  readonly departmentId: string;
  readonly taskType: string;
  readonly title: string;
  readonly description: string;
  readonly priority: TaskPriority;
  readonly status: TaskStatus;
  readonly assignedToUserId: string | null;
  readonly assignedToDisplayName?: string | null;
  readonly dueAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type MaintenanceCategory =
  | "repair"
  | "renovation"
  | "pool"
  | "linen"
  | "general";
export type MaintenanceStatus =
  | "open"
  | "quote_requested"
  | "approved"
  | "in_progress"
  | "done"
  | "cancelled";

export type MaintenanceRequestDto = {
  readonly id: string;
  readonly tenantId: string;
  readonly hotelId: string;
  readonly category: MaintenanceCategory;
  readonly title: string;
  readonly description: string;
  readonly priority: TaskPriority;
  readonly status: MaintenanceStatus;
  readonly vendorId: string | null;
  readonly dueAt: string | null;
  readonly estimatedCost: number | null;
  readonly actualCost: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type VendorCategory = "contractor" | "supplier" | "both";
export type VendorDto = {
  readonly id: string;
  readonly tenantId: string;
  readonly hotelId: string | null;
  readonly name: string;
  readonly category: VendorCategory;
  readonly contactName: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly rating: number | null;
};

export type QuoteStatus = "pending" | "accepted" | "rejected" | "expired";
export type VendorQuoteDto = {
  readonly id: string;
  readonly maintenanceRequestId: string | null;
  readonly vendorId: string;
  readonly amount: number;
  readonly currency: string;
  readonly status: QuoteStatus;
  readonly submittedAt: string;
};

export type InventoryCategory =
  | "towels"
  | "linens"
  | "pool_chemicals"
  | "cleaning"
  | "amenities"
  | "food"
  | "other";
export type InventoryItemDto = {
  readonly id: string;
  readonly hotelId: string;
  readonly category: InventoryCategory;
  readonly name: string;
  readonly unit: string;
  readonly currentStock: number;
  readonly reorderThreshold: number;
  readonly belowThreshold: boolean;
};

export type PurchaseOrderStatus =
  | "draft"
  | "sent"
  | "confirmed"
  | "received"
  | "paid"
  | "cancelled";
export type PurchaseOrderDto = {
  readonly id: string;
  readonly hotelId: string;
  readonly vendorId: string;
  readonly status: PurchaseOrderStatus;
  readonly totalAmount: number;
  readonly currency: string;
  readonly createdAt: string;
};

export type GuestFeedbackDto = {
  readonly id: string;
  readonly hotelId: string;
  readonly bookingId: string | null;
  readonly rating: number;
  readonly categories: readonly string[];
  readonly comment: string | null;
  readonly source: string;
  readonly submittedAt: string;
};

export type JobPostingStatus = "open" | "closed";
export type JobPostingDto = {
  readonly id: string;
  readonly hotelId: string;
  readonly title: string;
  readonly boardName: string;
  readonly externalUrl: string | null;
  readonly status: JobPostingStatus;
  readonly createdAt: string;
};

export type CandidateStage =
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "hired"
  | "rejected";
export type JobCandidateDto = {
  readonly id: string;
  readonly jobPostingId: string;
  readonly fullName: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly source: string;
  readonly stage: CandidateStage;
};

export type OpsDashboardHotelDto = {
  readonly hotelId: string;
  readonly hotelName: string;
  readonly departmentCount: number;
  readonly openMaintenanceRequests: number;
  readonly pendingQuoteRequests: number;
  readonly lowStockItems: number;
  readonly openPurchaseOrders: number;
  readonly averageFeedbackRating: number | null;
};

export async function listDepartments(
  hotelId: string,
): Promise<readonly DepartmentDto[]> {
  const payload = (await authGet(
    `/v1/ops/departments?${hotelQuery(hotelId)}`,
  )) as { data: DepartmentDto[] };
  return payload.data;
}

export async function fetchDepartmentTasks(
  hotelId: string,
  code: string,
): Promise<{
  readonly department: DepartmentSummaryDto;
  readonly tasks: readonly DepartmentTaskDto[];
}> {
  const payload = (await authGet(
    `/v1/ops/departments/${encodeURIComponent(code)}/tasks?${hotelQuery(hotelId)}`,
  )) as { data: { department: DepartmentSummaryDto; tasks: DepartmentTaskDto[] } };
  return payload.data;
}

export async function createDepartmentTask(
  hotelId: string,
  code: string,
  input: {
    taskType: string;
    title: string;
    description: string;
    priority?: TaskPriority;
    dueAt?: string;
  },
): Promise<DepartmentTaskDto> {
  const payload = (await authPost(
    `/v1/ops/departments/${encodeURIComponent(code)}/tasks?${hotelQuery(hotelId)}`,
    input,
  )) as { data: DepartmentTaskDto };
  return payload.data;
}

export async function updateDepartmentTaskStatus(
  taskId: string,
  status: TaskStatus,
): Promise<DepartmentTaskDto> {
  const payload = (await authPatch(`/v1/ops/tasks/${taskId}`, { status })) as {
    data: DepartmentTaskDto;
  };
  return payload.data;
}

export async function claimDepartmentTask(
  taskId: string,
): Promise<DepartmentTaskDto> {
  const payload = (await authPatch(`/v1/ops/tasks/${taskId}`, {
    claim: true,
  })) as {
    data: DepartmentTaskDto;
  };
  return payload.data;
}

export async function releaseDepartmentTask(
  taskId: string,
): Promise<DepartmentTaskDto> {
  const payload = (await authPatch(`/v1/ops/tasks/${taskId}`, {
    release: true,
  })) as {
    data: DepartmentTaskDto;
  };
  return payload.data;
}

export async function listMaintenanceRequests(
  hotelId: string,
): Promise<readonly MaintenanceRequestDto[]> {
  const payload = (await authGet(
    `/v1/ops/maintenance-requests?${hotelQuery(hotelId)}`,
  )) as { data: MaintenanceRequestDto[] };
  return payload.data;
}

export async function createMaintenanceRequest(
  hotelId: string,
  input: {
    category: MaintenanceCategory;
    title: string;
    description: string;
    priority?: TaskPriority;
    dueAt?: string;
  },
): Promise<MaintenanceRequestDto> {
  const payload = (await authPost(
    `/v1/ops/maintenance-requests?${hotelQuery(hotelId)}`,
    input,
  )) as { data: MaintenanceRequestDto };
  return payload.data;
}

export async function updateMaintenanceRequestStatus(
  requestId: string,
  status: MaintenanceStatus,
): Promise<MaintenanceRequestDto> {
  const payload = (await authPatch(
    `/v1/ops/maintenance-requests/${requestId}`,
    { status },
  )) as { data: MaintenanceRequestDto };
  return payload.data;
}

export async function listVendors(): Promise<readonly VendorDto[]> {
  const payload = (await authGet("/v1/ops/vendors")) as { data: VendorDto[] };
  return payload.data;
}

export async function createVendor(input: {
  name: string;
  category: VendorCategory;
  contactName?: string;
  phone?: string;
  email?: string;
}): Promise<VendorDto> {
  const payload = (await authPost("/v1/ops/vendors", input)) as {
    data: VendorDto;
  };
  return payload.data;
}

export async function createVendorQuote(
  requestId: string,
  input: {
    vendorId: string;
    amount: number;
    currency?: string;
    validUntil?: string;
  },
): Promise<VendorQuoteDto> {
  const payload = (await authPost(
    `/v1/ops/maintenance-requests/${requestId}/quotes`,
    input,
  )) as { data: VendorQuoteDto };
  return payload.data;
}

export async function listQuotesForRequest(
  requestId: string,
): Promise<readonly VendorQuoteDto[]> {
  const payload = (await authGet(
    `/v1/ops/maintenance-requests/${requestId}/quotes`,
  )) as { data: VendorQuoteDto[] };
  return payload.data;
}

export async function decideQuote(
  quoteId: string,
  status: "accepted" | "rejected",
): Promise<VendorQuoteDto> {
  const payload = (await authPost(`/v1/ops/quotes/${quoteId}/decision`, {
    status,
  })) as { data: VendorQuoteDto };
  return payload.data;
}

export async function listInventory(
  hotelId: string,
): Promise<readonly InventoryItemDto[]> {
  const payload = (await authGet(`/v1/ops/inventory?${hotelQuery(hotelId)}`)) as {
    data: InventoryItemDto[];
  };
  return payload.data;
}

export async function createInventoryItem(
  hotelId: string,
  input: {
    category: InventoryCategory;
    name: string;
    unit: string;
    currentStock: number;
    reorderThreshold: number;
  },
): Promise<InventoryItemDto> {
  const payload = (await authPost(
    `/v1/ops/inventory?${hotelQuery(hotelId)}`,
    input,
  )) as { data: InventoryItemDto };
  return payload.data;
}

export async function listPurchaseOrders(
  hotelId: string,
): Promise<readonly PurchaseOrderDto[]> {
  const payload = (await authGet(
    `/v1/ops/purchase-orders?${hotelQuery(hotelId)}`,
  )) as { data: PurchaseOrderDto[] };
  return payload.data;
}

export async function createPurchaseOrder(
  hotelId: string,
  input: {
    vendorId: string;
    currency?: string;
    notes?: string;
    items: readonly {
      inventoryItemId?: string;
      description: string;
      quantity: number;
      unitPrice: number;
    }[];
  },
): Promise<PurchaseOrderDto> {
  const payload = (await authPost(
    `/v1/ops/purchase-orders?${hotelQuery(hotelId)}`,
    input,
  )) as { data: PurchaseOrderDto };
  return payload.data;
}

export async function receivePurchaseOrder(
  orderId: string,
): Promise<PurchaseOrderDto> {
  const payload = (await authPost(
    `/v1/ops/purchase-orders/${orderId}/receive`,
  )) as { data: PurchaseOrderDto };
  return payload.data;
}

export async function fetchOpsFeedback(hotelId: string): Promise<{
  readonly average: number | null;
  readonly items: readonly GuestFeedbackDto[];
}> {
  const payload = (await authGet(`/v1/ops/feedback?${hotelQuery(hotelId)}`)) as {
    data: { average: number | null; items: GuestFeedbackDto[] };
  };
  return payload.data;
}

export type ReputationReviewDto = {
  readonly id: string;
  readonly hotelId: string;
  readonly source: "google" | "booking" | "tripadvisor" | "generic";
  readonly externalId: string;
  readonly rating: number;
  readonly title: string | null;
  readonly body: string;
  readonly authorName: string | null;
  readonly reviewUrl: string | null;
  readonly reviewedAt: string;
  readonly sentiment: "positive" | "neutral" | "negative";
  readonly topics: readonly string[];
  readonly taskId: string | null;
  readonly createdAt: string;
};

export async function fetchReputationReviews(
  hotelId: string,
  options?: {
    readonly sentiment?: "positive" | "neutral" | "negative";
    readonly limit?: number;
  },
): Promise<readonly ReputationReviewDto[]> {
  const params = new URLSearchParams(hotelQuery(hotelId));
  if (options?.sentiment !== undefined) {
    params.set("sentiment", options.sentiment);
  }
  if (options?.limit !== undefined) {
    params.set("limit", String(options.limit));
  }
  const payload = (await authGet(
    `/v1/ops/reputation/reviews?${params.toString()}`,
  )) as { data: ReputationReviewDto[] };
  return payload.data;
}

export async function ingestReputationReviewOps(
  provider: "generic" | "google" | "booking" | "tripadvisor",
  body: unknown,
): Promise<{
  readonly reviewId: string;
  readonly hotelId: string;
  readonly source: string;
  readonly sentiment: "positive" | "neutral" | "negative";
  readonly taskId: string | null;
  readonly duplicate: boolean;
}> {
  const payload = (await authPost(
    `/v1/ops/reputation/ingest/${encodeURIComponent(provider)}`,
    body,
  )) as {
    data: {
      reviewId: string;
      hotelId: string;
      source: string;
      sentiment: "positive" | "neutral" | "negative";
      taskId: string | null;
      duplicate: boolean;
    };
  };
  return payload.data;
}

export async function submitGuestFeedback(input: {
  bookingId: string;
  rating: number;
  categories: readonly string[];
  comment?: string;
}): Promise<GuestFeedbackDto> {
  const response = await fetch(`${getApiBase()}/v1/public/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(toErrorMessage(payload, "Feedback submission failed"));
  }
  return (payload as { data: GuestFeedbackDto }).data;
}

export async function submitGuestServiceRequest(input: {
  readonly email: string;
  readonly bookingId: string;
  readonly serviceType: "towels" | "cleaning" | "amenities";
  readonly note?: string;
}): Promise<{
  readonly taskId: string;
  readonly serviceType: string;
  readonly status: string;
}> {
  const response = await fetch(
    `${getApiBase()}/v1/public/stays/service-request`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(toErrorMessage(payload, "Service request failed"));
  }
  const body = payload as {
    data?: { taskId: string; serviceType: string; status: string };
  };
  if (!body.data) {
    throw new Error("Invalid service request response");
  }
  return body.data;
}

export async function listJobPostings(
  hotelId: string,
): Promise<readonly JobPostingDto[]> {
  const payload = (await authGet(
    `/v1/ops/recruiting/postings?${hotelQuery(hotelId)}`,
  )) as { data: JobPostingDto[] };
  return payload.data;
}

export async function createJobPosting(
  hotelId: string,
  input: {
    title: string;
    boardName: string;
    externalUrl?: string;
    notes?: string;
  },
): Promise<JobPostingDto> {
  const payload = (await authPost(
    `/v1/ops/recruiting/postings?${hotelQuery(hotelId)}`,
    input,
  )) as { data: JobPostingDto };
  return payload.data;
}

export async function listJobCandidates(
  hotelId: string,
  postingId: string,
): Promise<readonly JobCandidateDto[]> {
  const payload = (await authGet(
    `/v1/ops/recruiting/postings/${postingId}/candidates?${hotelQuery(hotelId)}`,
  )) as { data: JobCandidateDto[] };
  return payload.data;
}

export async function addJobCandidate(
  hotelId: string,
  postingId: string,
  input: { fullName: string; phone?: string; email?: string; source: string },
): Promise<JobCandidateDto> {
  const payload = (await authPost(
    `/v1/ops/recruiting/postings/${postingId}/candidates?${hotelQuery(hotelId)}`,
    input,
  )) as { data: JobCandidateDto };
  return payload.data;
}

export async function closeJobPosting(
  hotelId: string,
  postingId: string,
): Promise<JobPostingDto> {
  const payload = (await authPost(
    `/v1/ops/recruiting/postings/${postingId}/close?${hotelQuery(hotelId)}`,
    {},
  )) as { data: JobPostingDto };
  return payload.data;
}

export async function updateJobCandidateStage(
  hotelId: string,
  candidateId: string,
  stage: Exclude<CandidateStage, "offer" | "hired">,
): Promise<JobCandidateDto> {
  const payload = (await authPatch(
    `/v1/ops/recruiting/candidates/${candidateId}/stage?${hotelQuery(hotelId)}`,
    { stage },
  )) as { data: JobCandidateDto };
  return payload.data;
}

export async function suggestAutonomyRecruitingStage(input: {
  readonly hotelId: string;
  readonly candidateId: string;
  readonly stage: "offer" | "hired";
  readonly agentId?: string;
}): Promise<{
  readonly approvalId: string;
  readonly candidateId: string;
  readonly stage: "offer" | "hired";
}> {
  const payload = (await authPost(
    "/v1/autonomy/suggest-recruiting-stage",
    input,
  )) as {
    data: {
      approval: { id: string };
      candidateId: string;
      stage: "offer" | "hired";
    };
  };
  return {
    approvalId: payload.data.approval.id,
    candidateId: payload.data.candidateId,
    stage: payload.data.stage,
  };
}

export async function suggestAutonomyFeedbackFollowup(input: {
  readonly hotelId: string;
  readonly feedbackId: string;
  readonly agentId?: string;
}): Promise<{
  readonly approvalId: string;
  readonly feedbackId: string;
  readonly departmentCode: string;
  readonly rating: number;
}> {
  const payload = (await authPost(
    "/v1/autonomy/suggest-feedback-followup",
    input,
  )) as {
    data: {
      approval: { id: string };
      feedbackId: string;
      departmentCode: string;
      rating: number;
    };
  };
  return {
    approvalId: payload.data.approval.id,
    feedbackId: payload.data.feedbackId,
    departmentCode: payload.data.departmentCode,
    rating: payload.data.rating,
  };
}

export async function fetchOpsDashboard(): Promise<{
  readonly hotels: readonly OpsDashboardHotelDto[];
}> {
  const payload = (await authGet("/v1/ops/dashboard")) as {
    data: { hotels: OpsDashboardHotelDto[] };
  };
  return payload.data;
}

export type OpsKnowledgeGraphNodeDto = {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly meta?: Record<string, string | number | boolean | null>;
};

export type OpsKnowledgeGraphEdgeDto = {
  readonly from: string;
  readonly to: string;
  readonly type: string;
};

export type OpsKnowledgeGraphDto = {
  readonly generatedAt: string;
  readonly nodes: readonly OpsKnowledgeGraphNodeDto[];
  readonly edges: readonly OpsKnowledgeGraphEdgeDto[];
};

export async function fetchOpsKnowledgeGraph(
  hotelId: string,
): Promise<OpsKnowledgeGraphDto> {
  const params = new URLSearchParams({ hotelId });
  const payload = (await authGet(
    `/v1/ops/knowledge-graph?${params.toString()}`,
  )) as { data: OpsKnowledgeGraphDto };
  return payload.data;
}

export type DailyBriefingHotelDto = {
  readonly hotelId: string;
  readonly hotelName: string;
  readonly occupancyPercent: number;
  readonly activeBookings: number;
  readonly roomsNeedingCleaning: number;
  readonly departmentCount: number;
  readonly openMaintenanceRequests: number;
  readonly urgentMaintenanceRequests: number;
  readonly lowStockItems: number;
  readonly openPurchaseOrders: number;
  readonly averageFeedbackRating: number | null;
  readonly highlights: readonly string[];
  readonly warnings: readonly string[];
  readonly suggestedActions: readonly string[];
  readonly summaryHe: string;
};

export type DailyBriefingDto = {
  readonly generatedAt: string;
  readonly tenantName: string;
  readonly hotels: readonly DailyBriefingHotelDto[];
  readonly chainSummaryHe: string | null;
};

export async function fetchDailyBriefing(): Promise<DailyBriefingDto> {
  const payload = (await authGet("/v1/ops/daily-briefing")) as {
    data: DailyBriefingDto;
  };
  return payload.data;
}
