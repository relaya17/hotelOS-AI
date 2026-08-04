import {
  authGet,
  authPost,
  getApiBase,
  hotelQuery,
} from "./core.js";

export type HrEmployeeDto = {
  readonly id: string;
  readonly userId: string | null;
  readonly displayName: string;
  readonly roleLabel: string;
  readonly preferredLocale: string;
  readonly hotelId: string | null;
  readonly employeeCode: string | null;
  readonly phone: string | null;
  readonly status: string;
  readonly departmentId: string | null;
  readonly createdAt: string;
};

export type HrInviteDto = {
  readonly id: string;
  readonly email: string;
  readonly displayNameHint: string;
  readonly roleHint: string;
  readonly expiresAt: string;
  readonly consumedAt: string | null;
  readonly createdAt: string;
};

export async function listHrEmployees(
  hotelId?: string,
): Promise<readonly HrEmployeeDto[]> {
  const qs = hotelId ? `?${hotelQuery(hotelId)}` : "";
  const payload = (await authGet(`/v1/hr/employees${qs}`)) as {
    data: HrEmployeeDto[];
  };
  return payload.data;
}

export async function listHrInvites(
  hotelId: string,
): Promise<readonly HrInviteDto[]> {
  const payload = (await authGet(
    `/v1/hr/invites?${hotelQuery(hotelId)}`,
  )) as { data: HrInviteDto[] };
  return payload.data;
}

export type HrDocumentDto = {
  readonly id: string;
  readonly docType: string;
  readonly status: string;
  readonly contentHash: string | null;
  readonly issuingAuthority: string | null;
  readonly expiresAt: string | null;
  readonly uploadedAt: string;
};

export type HrEmployeeDetailDto = HrEmployeeDto & {
  readonly documents: readonly HrDocumentDto[];
  /** Server-derived: principal has dedicated `hr` role for תעודת יושר. */
  readonly viewerCanReviewCriminalRecord?: boolean;
};

export async function fetchHrEmployee(
  employeeId: string,
): Promise<HrEmployeeDetailDto> {
  const payload = (await authGet(`/v1/hr/employees/${employeeId}`)) as {
    data: HrEmployeeDetailDto;
  };
  return payload.data;
}

export async function registerHrDocumentFlag(
  employeeId: string,
  input: {
    readonly docType:
      | "criminal_record_clearance"
      | "id_card"
      | "contract"
      | "certification"
      | "other";
    readonly contentHash?: string;
    readonly issuingAuthority?: string;
    readonly issuedAt?: string;
    readonly expiresAt?: string;
    readonly notes?: string;
  },
): Promise<{ readonly id: string; readonly status: string }> {
  const payload = (await authPost(
    `/v1/hr/employees/${employeeId}/documents`,
    input,
  )) as { data: { id: string; status: string } };
  return payload.data;
}

export async function reviewHrDocument(
  documentId: string,
  input: {
    readonly status: "approved" | "rejected" | "expired";
    readonly notes?: string;
  },
): Promise<{ readonly id: string; readonly status: string }> {
  const payload = (await authPost(
    `/v1/hr/documents/${documentId}/review`,
    input,
  )) as { data: { id: string; status: string } };
  return payload.data;
}

export async function createHrInvite(input: {
  readonly hotelId: string;
  readonly email: string;
  readonly displayNameHint: string;
  readonly roleHint: string;
  readonly departmentId?: string;
  readonly expiresInDays?: number;
}): Promise<{
  readonly id: string;
  readonly email: string;
  readonly expiresAt: string;
  readonly inviteUrlPath: string;
  readonly token: string;
}> {
  const payload = (await authPost("/v1/hr/invites", input)) as {
    data: {
      id: string;
      email: string;
      expiresAt: string;
      inviteUrlPath: string;
      token: string;
    };
  };
  return payload.data;
}

export type PublicHrInviteDto = {
  readonly email: string;
  readonly displayNameHint: string;
  readonly roleHint: string;
  readonly hotelId: string;
  readonly expiresAt: string;
};

export async function fetchPublicHrInvite(
  token: string,
): Promise<PublicHrInviteDto> {
  const response = await fetch(
    `${getApiBase()}/v1/public/hr/invites/${encodeURIComponent(token)}`,
  );
  if (!response.ok) {
    throw new Error("ההזמנה לא זמינה או שפגה");
  }
  const payload = (await response.json()) as { data: PublicHrInviteDto };
  return payload.data;
}

export async function completePublicHrInvite(
  token: string,
  input: {
    readonly displayName: string;
    readonly phone?: string;
    readonly nationalId?: string;
    readonly address?: string;
    readonly emergencyContactName?: string;
    readonly emergencyContactPhone?: string;
    readonly preferredLocale?: string;
    readonly password: string;
  },
): Promise<{
  readonly employeeId: string;
  readonly employeeCode: string | null;
  readonly userId: string;
}> {
  const response = await fetch(
    `${getApiBase()}/v1/public/hr/invites/${encodeURIComponent(token)}/complete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    throw new Error("השלמת ההרשמה נכשלה");
  }
  const payload = (await response.json()) as {
    data: {
      employeeId: string;
      employeeCode: string | null;
      userId: string;
    };
  };
  return payload.data;
}

export type LetterDraftDto = {
  readonly id: string;
  readonly kind: "formal_letter" | "purchase_note" | "speech";
  readonly subject: string;
  readonly recipientLabel: string;
  readonly body: string;
  readonly status: string;
  readonly createdAt: string;
};

export async function listLetterDrafts(
  hotelId?: string,
): Promise<readonly LetterDraftDto[]> {
  const qs = hotelId ? `?${hotelQuery(hotelId)}` : "";
  const payload = (await authGet(`/v1/correspondence/drafts${qs}`)) as {
    data: LetterDraftDto[];
  };
  return payload.data;
}

export async function createLetterDraft(input: {
  readonly kind: "formal_letter" | "purchase_note" | "speech";
  readonly subject: string;
  readonly recipientLabel: string;
  readonly hotelId?: string;
  readonly contextNotes?: string;
}): Promise<LetterDraftDto> {
  const payload = (await authPost("/v1/correspondence/drafts", input)) as {
    data: LetterDraftDto;
  };
  return payload.data;
}

export type LegalChecklistItemDto = {
  readonly id: string;
  readonly labelHe: string;
  readonly required: boolean;
  readonly status: "pass" | "fail" | "needs_ack";
  readonly detailHe: string;
};

export type LegalChecklistDto = {
  readonly draftId: string;
  readonly kind: string;
  readonly applies: boolean;
  readonly gateHe: string;
  readonly items: readonly LegalChecklistItemDto[];
  readonly requiredItemIds: readonly string[];
  readonly autoPassedItemIds: readonly string[];
  readonly blockingItemIds: readonly string[];
  readonly canApproveWithoutAck: boolean;
};

export async function fetchLetterLegalChecklist(
  draftId: string,
): Promise<LegalChecklistDto> {
  const payload = (await authGet(
    `/v1/correspondence/drafts/${draftId}/legal-checklist`,
  )) as { data: LegalChecklistDto };
  return payload.data;
}

export async function updateLetterDraftStatus(
  draftId: string,
  status: "draft" | "approved" | "discarded",
  options?: { readonly acknowledgedItemIds?: readonly string[] },
): Promise<LetterDraftDto> {
  const payload = (await authPost(
    `/v1/correspondence/drafts/${draftId}/status`,
    {
      status,
      ...(options?.acknowledgedItemIds
        ? { acknowledgedItemIds: options.acknowledgedItemIds }
        : {}),
    },
  )) as { data: LetterDraftDto };
  return payload.data;
}

export type AssessmentTemplateDto = {
  readonly id: string;
  readonly tenantId?: string | null;
  readonly titleHe: string;
  readonly titleEn: string;
  readonly category: string;
  readonly passingScore: number;
  readonly questionCount: number;
};

export async function listAssessmentTemplates(): Promise<
  readonly AssessmentTemplateDto[]
> {
  const payload = (await authGet("/v1/hr/assessment-templates")) as {
    data: AssessmentTemplateDto[];
  };
  return payload.data;
}

export async function createAssessmentTemplate(input: {
  readonly titleHe: string;
  readonly titleEn: string;
  readonly category:
    | "service"
    | "role_knowledge"
    | "safety"
    | "compliance"
    | "other";
  readonly passingScore: number;
  readonly questions: readonly {
    readonly id: string;
    readonly promptHe: string;
    readonly options: readonly {
      readonly id: string;
      readonly labelHe: string;
    }[];
    readonly correctOptionId: string;
  }[];
}): Promise<AssessmentTemplateDto> {
  const payload = (await authPost("/v1/hr/assessment-templates", input)) as {
    data: AssessmentTemplateDto;
  };
  return payload.data;
}

export async function assignAssessment(
  employeeId: string,
  templateId: string,
): Promise<unknown> {
  return authPost(`/v1/hr/employees/${employeeId}/assessments`, {
    templateId,
  });
}

export async function listEmployeeAssessments(
  employeeId: string,
): Promise<
  readonly {
    readonly id: string;
    readonly templateId: string;
    readonly status: string;
    readonly titleHe?: string;
    readonly createdAt: string;
  }[]
> {
  const payload = (await authGet(
    `/v1/hr/employees/${employeeId}/assessments`,
  )) as {
    data: {
      id: string;
      templateId: string;
      status: string;
      titleHe?: string;
      createdAt: string;
    }[];
  };
  return payload.data;
}

export type AssessmentDetailDto = {
  readonly id: string;
  readonly status: string;
  readonly titleHe?: string;
  readonly passingScore: number;
  readonly questions: readonly {
    readonly id: string;
    readonly promptHe: string;
    readonly options: readonly { readonly id: string; readonly labelHe: string }[];
  }[];
};

export async function fetchAssessmentDetail(
  assignmentId: string,
): Promise<AssessmentDetailDto> {
  const payload = (await authGet(`/v1/hr/assessments/${assignmentId}`)) as {
    data: AssessmentDetailDto;
  };
  return payload.data;
}

export async function submitAssessment(
  assignmentId: string,
  answers: Readonly<Record<string, string>>,
): Promise<{ readonly score: number; readonly passed: boolean }> {
  const payload = (await authPost(
    `/v1/hr/assessments/${assignmentId}/submit`,
    { answers },
  )) as { data: { score: number; passed: boolean } };
  return payload.data;
}
