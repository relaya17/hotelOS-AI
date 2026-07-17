import { and, desc, eq } from "drizzle-orm";
import type { TenantId, UserId } from "@hotelos/shared";
import { randomUUID } from "node:crypto";
import type { HotelOsDb } from "../client.js";
import {
  automationRuns,
  automations,
  employeeProfiles,
  journalEntries,
  ledgerAccounts,
  staffChatMessages,
} from "../schema/turbo.js";

export type EmployeeProfile = {
  readonly id: string;
  readonly displayName: string;
  readonly roleLabel: string;
  readonly preferredLocale: string;
  readonly hotelId: string | null;
};

export type StaffChatMessage = {
  readonly id: string;
  readonly channel: string;
  readonly authorName: string;
  readonly sourceLocale: string;
  readonly sourceBody: string;
  readonly translations: Record<string, string>;
  readonly verification: string;
  readonly createdAt: string;
};

export type LedgerAccount = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly accountType: string;
  readonly currency: string;
  readonly balanceMinor: number;
};

export type JournalEntry = {
  readonly id: string;
  readonly accountCode: string;
  readonly accountName: string;
  readonly memo: string;
  readonly debit: number;
  readonly credit: number;
  readonly entryDate: string;
  readonly sourceSystem: string;
};

export type AutomationRule = {
  readonly id: string;
  readonly name: string;
  readonly domain: string;
  readonly triggerKey: string;
  readonly actionKey: string;
  readonly enabled: boolean;
  readonly lastRunAt: string | null;
};

export type AutomationRun = {
  readonly id: string;
  readonly automationId: string;
  readonly status: string;
  readonly detail: string;
  readonly createdAt: string;
};

export type TurboRepository = {
  ensureDemo: (input: {
    readonly tenantId: TenantId;
    readonly hostUserId: UserId;
    readonly hotelTlvId: string;
    readonly hotelEilatId: string;
  }) => Promise<void>;
  listEmployees: (tenantId: TenantId) => Promise<readonly EmployeeProfile[]>;
  listChatMessages: (
    tenantId: TenantId,
    channel: string,
  ) => Promise<readonly StaffChatMessage[]>;
  postChatMessage: (input: {
    readonly id: string;
    readonly tenantId: TenantId;
    readonly channel: string;
    readonly authorName: string;
    readonly authorUserId: UserId;
    readonly sourceLocale: string;
    readonly sourceBody: string;
    readonly translationsJson: string;
    readonly verification: string;
    readonly createdAt: string;
  }) => Promise<StaffChatMessage>;
  listAccounts: (tenantId: TenantId) => Promise<readonly LedgerAccount[]>;
  listJournal: (tenantId: TenantId) => Promise<readonly JournalEntry[]>;
  listAutomations: (tenantId: TenantId) => Promise<readonly AutomationRule[]>;
  setAutomationEnabled: (
    tenantId: TenantId,
    automationId: string,
    enabled: boolean,
  ) => Promise<AutomationRule | null>;
  runAutomation: (
    tenantId: TenantId,
    automationId: string,
    detail: string,
  ) => Promise<AutomationRun | null>;
  listAutomationRuns: (
    tenantId: TenantId,
  ) => Promise<readonly AutomationRun[]>;
};

function parseTranslations(json: string): Record<string, string> {
  try {
    const value = JSON.parse(json) as unknown;
    if (typeof value !== "object" || value === null) {
      return {};
    }
    return value as Record<string, string>;
  } catch {
    return {};
  }
}

export function createTurboRepository(db: HotelOsDb): TurboRepository {
  return {
    async ensureDemo(input) {
      const now = new Date().toISOString();
      const employees = [
        {
          id: "e1000000-0000-4000-8000-000000000001",
          displayName: "Demo Admin",
          roleLabel: "מנהל אזור",
          preferredLocale: "he",
          userId: input.hostUserId,
          hotelId: input.hotelTlvId,
        },
        {
          id: "e1000000-0000-4000-8000-000000000002",
          displayName: "Ahmed Hassan",
          roleLabel: "Housekeeping",
          preferredLocale: "ar",
          userId: null as string | null,
          hotelId: input.hotelTlvId,
        },
        {
          id: "e1000000-0000-4000-8000-000000000003",
          displayName: "Elena Petrova",
          roleLabel: "Reception",
          preferredLocale: "ru",
          userId: null,
          hotelId: input.hotelTlvId,
        },
        {
          id: "e1000000-0000-4000-8000-000000000004",
          displayName: "Carlos Ruiz",
          roleLabel: "Maintenance",
          preferredLocale: "es",
          userId: null,
          hotelId: input.hotelEilatId,
        },
        {
          id: "e1000000-0000-4000-8000-000000000005",
          displayName: "Mei Lin",
          roleLabel: "Finance analyst",
          preferredLocale: "zh",
          userId: null,
          hotelId: input.hotelTlvId,
        },
        {
          id: "e1000000-0000-4000-8000-000000000006",
          displayName: "Priya Sharma",
          roleLabel: "Night auditor",
          preferredLocale: "hi",
          userId: null,
          hotelId: input.hotelEilatId,
        },
      ] as const;

      for (const employee of employees) {
        const existing = await db
          .select()
          .from(employeeProfiles)
          .where(eq(employeeProfiles.id, employee.id))
          .get();
        if (existing) continue;
        await db.insert(employeeProfiles)
          .values({
            id: employee.id,
            tenantId: input.tenantId,
            userId: employee.userId,
            displayName: employee.displayName,
            roleLabel: employee.roleLabel,
            preferredLocale: employee.preferredLocale,
            hotelId: employee.hotelId,
            createdAt: now,
          })
          .run();
      }

      const accounts = [
        {
          id: "a1000000-0000-4000-8000-000000000001",
          code: "1000",
          name: "Cash / Banks",
          accountType: "asset",
        },
        {
          id: "a1000000-0000-4000-8000-000000000002",
          code: "1100",
          name: "Accounts Receivable",
          accountType: "asset",
        },
        {
          id: "a1000000-0000-4000-8000-000000000003",
          code: "4000",
          name: "Room Revenue",
          accountType: "revenue",
        },
        {
          id: "a1000000-0000-4000-8000-000000000004",
          code: "5000",
          name: "Operating Expenses",
          accountType: "expense",
        },
        {
          id: "a1000000-0000-4000-8000-000000000005",
          code: "2000",
          name: "Accounts Payable",
          accountType: "liability",
        },
      ] as const;

      for (const account of accounts) {
        const existing = await db
          .select()
          .from(ledgerAccounts)
          .where(eq(ledgerAccounts.id, account.id))
          .get();
        if (existing) continue;
        await db.insert(ledgerAccounts)
          .values({
            id: account.id,
            tenantId: input.tenantId,
            code: account.code,
            name: account.name,
            accountType: account.accountType,
            currency: "ILS",
            createdAt: now,
          })
          .run();
      }

      const journals = [
        {
          id: "j1000000-0000-4000-8000-000000000001",
          accountId: "a1000000-0000-4000-8000-000000000003",
          memo: "Room revenue — Tel Aviv",
          debit: 0,
          credit: 4850000,
          sourceSystem: "hotelos.internal",
        },
        {
          id: "j1000000-0000-4000-8000-000000000002",
          accountId: "a1000000-0000-4000-8000-000000000001",
          memo: "Settlement deposit",
          debit: 4850000,
          credit: 0,
          sourceSystem: "hotelos.internal",
        },
        {
          id: "j1000000-0000-4000-8000-000000000003",
          accountId: "a1000000-0000-4000-8000-000000000004",
          memo: "Housekeeping payroll accrual",
          debit: 920000,
          credit: 0,
          sourceSystem: "external.erp.connector",
        },
        {
          id: "j1000000-0000-4000-8000-000000000004",
          accountId: "a1000000-0000-4000-8000-000000000005",
          memo: "Vendor AP — linen",
          debit: 0,
          credit: 210000,
          sourceSystem: "external.erp.connector",
        },
      ] as const;

      for (const entry of journals) {
        const existing = await db
          .select()
          .from(journalEntries)
          .where(eq(journalEntries.id, entry.id))
          .get();
        if (existing) continue;
        await db.insert(journalEntries)
          .values({
            id: entry.id,
            tenantId: input.tenantId,
            accountId: entry.accountId,
            memo: entry.memo,
            debit: entry.debit,
            credit: entry.credit,
            entryDate: "2026-07-17",
            sourceSystem: entry.sourceSystem,
            createdAt: now,
          })
          .run();
      }

      const rules = [
        {
          id: "u1000000-0000-4000-8000-000000000001",
          name: "Dirty rooms → Housekeeping alert",
          domain: "operations",
          triggerKey: "rooms.dirty.threshold",
          actionKey: "notify.housekeeping",
        },
        {
          id: "u1000000-0000-4000-8000-000000000002",
          name: "New booking → Reception queue",
          domain: "front_office",
          triggerKey: "booking.created",
          actionKey: "notify.reception",
        },
        {
          id: "u1000000-0000-4000-8000-000000000003",
          name: "Finance committee → Share CFO agent",
          domain: "finance",
          triggerKey: "briefing.finance.started",
          actionKey: "agent.share.cfo",
        },
        {
          id: "u1000000-0000-4000-8000-000000000004",
          name: "Staff instruction → Auto-translate",
          domain: "workforce",
          triggerKey: "chat.instruction.posted",
          actionKey: "i18n.translate.deliver",
        },
        {
          id: "u1000000-0000-4000-8000-000000000005",
          name: "Voice intent → Turbo router",
          domain: "ai",
          triggerKey: "voice.intent.detected",
          actionKey: "agent.route.action",
        },
        {
          id: "u1000000-0000-4000-8000-000000000006",
          name: "Daily cash close → Accounting sync",
          domain: "accounting",
          triggerKey: "night.audit.close",
          actionKey: "ledger.sync.internal_or_external",
        },
      ] as const;

      for (const rule of rules) {
        const existing = await db
          .select()
          .from(automations)
          .where(eq(automations.id, rule.id))
          .get();
        if (existing) continue;
        await db.insert(automations)
          .values({
            id: rule.id,
            tenantId: input.tenantId,
            name: rule.name,
            domain: rule.domain,
            triggerKey: rule.triggerKey,
            actionKey: rule.actionKey,
            enabled: 1,
            lastRunAt: null,
            createdAt: now,
          })
          .run();
      }

      const chatId = "c1000000-0000-4000-8000-000000000001";
      const existingChat = await db
        .select()
        .from(staffChatMessages)
        .where(eq(staffChatMessages.id, chatId))
        .get();
      if (!existingChat) {
        await db.insert(staffChatMessages)
          .values({
            id: chatId,
            tenantId: input.tenantId,
            channel: "ops",
            authorName: "Demo Admin",
            authorUserId: input.hostUserId,
            sourceLocale: "he",
            sourceBody: "נקו את החדר 102 לפני הצ׳ק־אין",
            translationsJson: JSON.stringify({
              he: "נקו את החדר 102 לפני הצ׳ק־אין",
              en: "Clean room 102 before check-in",
              ar: "نظّفوا الغرفة 102 قبل تسجيل الوصول",
              ru: "Уберите номер 102 до заезда",
              es: "Limpien la habitación 102 antes del check-in",
              th: "ทำความสะอาดห้อง 102 ก่อนเช็กอิน",
              zh: "请在入住前清洁 102 号房间",
              hi: "चेक-इन से पहले कमरा 102 साफ करें",
              tr: "Check-in öncesi 102 numaralı odayı temizleyin",
              el: "Καθαρίστε το δωμάτιο 102 πριν το check-in",
            }),
            verification: "verified",
            createdAt: now,
          })
          .run();
      }
    },

    async listEmployees(tenantId) {
      const rows = await db
        .select()
        .from(employeeProfiles)
        .where(eq(employeeProfiles.tenantId, tenantId))
        .all();
      return rows.map((row) => ({
        id: row.id,
        displayName: row.displayName,
        roleLabel: row.roleLabel,
        preferredLocale: row.preferredLocale,
        hotelId: row.hotelId,
      }));
    },

    async listChatMessages(tenantId, channel) {
      const rows = await db
        .select()
        .from(staffChatMessages)
        .where(
          and(
            eq(staffChatMessages.tenantId, tenantId),
            eq(staffChatMessages.channel, channel),
          ),
        )
        .orderBy(desc(staffChatMessages.createdAt))
        .all();
      return rows.map((row) => ({
        id: row.id,
        channel: row.channel,
        authorName: row.authorName,
        sourceLocale: row.sourceLocale,
        sourceBody: row.sourceBody,
        translations: parseTranslations(row.translationsJson),
        verification: row.verification,
        createdAt: row.createdAt,
      }));
    },

    async postChatMessage(input) {
      await db.insert(staffChatMessages)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          channel: input.channel,
          authorName: input.authorName,
          authorUserId: input.authorUserId,
          sourceLocale: input.sourceLocale,
          sourceBody: input.sourceBody,
          translationsJson: input.translationsJson,
          verification: input.verification,
          createdAt: input.createdAt,
        })
        .run();
      return {
        id: input.id,
        channel: input.channel,
        authorName: input.authorName,
        sourceLocale: input.sourceLocale,
        sourceBody: input.sourceBody,
        translations: parseTranslations(input.translationsJson),
        verification: input.verification,
        createdAt: input.createdAt,
      };
    },

    async listAccounts(tenantId) {
      const accounts = await db
        .select()
        .from(ledgerAccounts)
        .where(eq(ledgerAccounts.tenantId, tenantId))
        .all();
      return Promise.all(
        accounts.map(async (account) => {
          const entries = await db
            .select()
            .from(journalEntries)
            .where(eq(journalEntries.accountId, account.id))
            .all();
          const balanceMinor = entries.reduce(
            (sum, entry) => sum + entry.debit - entry.credit,
            0,
          );
          return {
            id: account.id,
            code: account.code,
            name: account.name,
            accountType: account.accountType,
            currency: account.currency,
            balanceMinor,
          };
        }),
      );
    },

    async listJournal(tenantId) {
      const rows = await db
        .select({
          entry: journalEntries,
          account: ledgerAccounts,
        })
        .from(journalEntries)
        .innerJoin(
          ledgerAccounts,
          eq(journalEntries.accountId, ledgerAccounts.id),
        )
        .where(eq(journalEntries.tenantId, tenantId))
        .orderBy(desc(journalEntries.entryDate))
        .all();
      return rows.map((row) => ({
        id: row.entry.id,
        accountCode: row.account.code,
        accountName: row.account.name,
        memo: row.entry.memo,
        debit: row.entry.debit,
        credit: row.entry.credit,
        entryDate: row.entry.entryDate,
        sourceSystem: row.entry.sourceSystem,
      }));
    },

    async listAutomations(tenantId) {
      const rows = await db
        .select()
        .from(automations)
        .where(eq(automations.tenantId, tenantId))
        .all();
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        domain: row.domain,
        triggerKey: row.triggerKey,
        actionKey: row.actionKey,
        enabled: row.enabled === 1,
        lastRunAt: row.lastRunAt,
      }));
    },

    async setAutomationEnabled(tenantId, automationId, enabled) {
      const existing = await db
        .select()
        .from(automations)
        .where(
          and(
            eq(automations.id, automationId),
            eq(automations.tenantId, tenantId),
          ),
        )
        .get();
      if (!existing) return null;
      await db.update(automations)
        .set({ enabled: enabled ? 1 : 0 })
        .where(eq(automations.id, automationId))
        .run();
      return {
        id: existing.id,
        name: existing.name,
        domain: existing.domain,
        triggerKey: existing.triggerKey,
        actionKey: existing.actionKey,
        enabled,
        lastRunAt: existing.lastRunAt,
      };
    },

    async runAutomation(tenantId, automationId, detail) {
      const existing = await db
        .select()
        .from(automations)
        .where(
          and(
            eq(automations.id, automationId),
            eq(automations.tenantId, tenantId),
          ),
        )
        .get();
      if (!existing || existing.enabled !== 1) return null;
      const now = new Date().toISOString();
      const runId = randomUUID();
      await db.update(automations)
        .set({ lastRunAt: now })
        .where(eq(automations.id, automationId))
        .run();
      await db.insert(automationRuns)
        .values({
          id: runId,
          tenantId,
          automationId,
          status: "ok",
          detail,
          createdAt: now,
        })
        .run();
      return {
        id: runId,
        automationId,
        status: "ok",
        detail,
        createdAt: now,
      };
    },

    async listAutomationRuns(tenantId) {
      const rows = await db
        .select()
        .from(automationRuns)
        .where(eq(automationRuns.tenantId, tenantId))
        .orderBy(desc(automationRuns.createdAt))
        .all();
      return rows.map((row) => ({
        id: row.id,
        automationId: row.automationId,
        status: row.status,
        detail: row.detail,
        createdAt: row.createdAt,
      }));
    },
  };
}
