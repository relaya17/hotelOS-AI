import { authGet, authPost } from "./core.js";

export type EmployeeDto = {
  readonly id: string;
  readonly displayName: string;
  readonly roleLabel: string;
  readonly preferredLocale: string;
  readonly hotelId: string | null;
};

export type StaffChatDeliveryDto = {
  readonly employeeId: string;
  readonly displayName: string;
  readonly preferredLocale: string;
  readonly body: string;
};

export type StaffChatMessageDto = {
  readonly id: string;
  readonly channel: string;
  readonly authorName: string;
  readonly sourceLocale: string;
  readonly sourceBody: string;
  readonly translations: Record<string, string>;
  readonly verification: string;
  readonly createdAt: string;
  readonly bodyForViewer: string;
  readonly deliveries: readonly StaffChatDeliveryDto[];
};

export type AccountingDto = {
  readonly mode: string;
  readonly integration: {
    readonly internalProgram: string;
    readonly externalConnectors: readonly string[];
    readonly note: string;
  };
  readonly accounts: readonly {
    readonly id: string;
    readonly code: string;
    readonly name: string;
    readonly accountType: string;
    readonly currency: string;
    readonly balanceMinor: number;
  }[];
  readonly journal: readonly {
    readonly id: string;
    readonly accountCode: string;
    readonly accountName: string;
    readonly memo: string;
    readonly debit: number;
    readonly credit: number;
    readonly entryDate: string;
    readonly sourceSystem: string;
  }[];
};

export type AutomationBundleDto = {
  readonly rules: readonly {
    readonly id: string;
    readonly name: string;
    readonly domain: string;
    readonly triggerKey: string;
    readonly actionKey: string;
    readonly enabled: boolean;
    readonly lastRunAt: string | null;
  }[];
  readonly runs: readonly {
    readonly id: string;
    readonly automationId: string;
    readonly status: string;
    readonly detail: string;
    readonly createdAt: string;
  }[];
};

export type VoiceIntentDto = {
  readonly intent: string;
  readonly action: string;
  readonly automationHint: string;
  readonly replyHe: string;
  readonly replyEn: string;
  readonly automationId: string | null;
  readonly runId: string | null;
  readonly effect: string | null;
  readonly taskId: string | null;
};

export async function fetchStaffChat(
  channel: string,
  locale: string,
): Promise<{
  readonly channel: string;
  readonly viewerLocale: string;
  readonly messages: readonly StaffChatMessageDto[];
}> {
  const payload = (await authGet(
    `/v1/turbo/chat/${channel}?locale=${encodeURIComponent(locale)}`,
  )) as {
    data: {
      channel: string;
      viewerLocale: string;
      messages: StaffChatMessageDto[];
    };
  };
  return payload.data;
}

export async function postStaffChatInstruction(input: {
  channel?: string;
  body: string;
  sourceLocale?: string;
}): Promise<void> {
  await authPost("/v1/turbo/chat", {
    channel: input.channel ?? "ops",
    body: input.body,
    sourceLocale: input.sourceLocale ?? "he",
  });
}

export async function fetchAccounting(): Promise<AccountingDto> {
  const payload = (await authGet("/v1/turbo/accounting")) as {
    data: AccountingDto;
  };
  return payload.data;
}

export async function fetchAutomations(): Promise<AutomationBundleDto> {
  const payload = (await authGet("/v1/turbo/automations")) as {
    data: AutomationBundleDto;
  };
  return payload.data;
}

export async function toggleAutomation(
  id: string,
  enabled: boolean,
): Promise<void> {
  await authPost(`/v1/turbo/automations/${id}/toggle`, { enabled });
}

export async function runAutomation(id: string): Promise<void> {
  await authPost(`/v1/turbo/automations/${id}/run`);
}

export async function submitVoiceIntent(
  transcript: string,
): Promise<VoiceIntentDto> {
  const payload = (await authPost("/v1/turbo/voice/intent", { transcript })) as {
    data: VoiceIntentDto;
  };
  return payload.data;
}

export async function listEmployees(): Promise<readonly EmployeeDto[]> {
  const payload = (await authGet("/v1/turbo/employees")) as {
    data: EmployeeDto[];
  };
  return payload.data;
}
