import type { TurboRepository } from "@hotelos/database";
import type { TenantId } from "@hotelos/shared";

const MAX_ACCOUNTS = 12;
const MAX_JOURNAL = 8;
const MAX_PACK = 4000;

/**
 * Internal ledger snapshot for agent.cfo — facts only, no invented balances.
 * Stage ז׳ MVP: RAG-ready pack; ledger close remains human-gated (not in this pack).
 */
export async function buildAccountingContextPack(
  turbo: TurboRepository,
  tenantId: TenantId,
): Promise<string | undefined> {
  const [accounts, journal] = await Promise.all([
    turbo.listAccounts(tenantId),
    turbo.listJournal(tenantId),
  ]);
  if (accounts.length === 0 && journal.length === 0) return undefined;

  const sortedAccounts = [...accounts]
    .sort((a, b) => Math.abs(b.balanceMinor) - Math.abs(a.balanceMinor))
    .slice(0, MAX_ACCOUNTS);

  const recentJournal = [...journal]
    .sort((a, b) => b.entryDate.localeCompare(a.entryDate))
    .slice(0, MAX_JOURNAL);

  const lines = [
    "Context pack — Accounting ledger (internal, read-only)",
    "השתמש ביתרות ובתנועות אלה כעובדות פנימיות בלבד. ציטוט: Ledger · קוד חשבון · תאריך.",
    "סגירת ספרים / ledger close — הצעה בלבד; ביצוע רק אחרי אישור רו״ח (accountant).",
  ];

  if (sortedAccounts.length > 0) {
    lines.push("חשבונות (לפי |יתרה| יורד):");
    for (const account of sortedAccounts) {
      lines.push(
        `• ${account.code} ${account.name} [${account.accountType}] = ${formatMinor(account.balanceMinor, account.currency)} (ציטוט: Ledger · ${account.code})`,
      );
    }
  }

  if (recentJournal.length > 0) {
    lines.push("תנועות אחרונות:");
    for (const entry of recentJournal) {
      lines.push(
        `• ${entry.entryDate} ${entry.accountCode} ${entry.memo} חובה=${entry.debit} זכות=${entry.credit} (${entry.sourceSystem}) (ציטוט: Ledger · ${entry.accountCode} · ${entry.entryDate})`,
      );
    }
  }

  let pack = lines.join("\n");
  if (pack.length > MAX_PACK) {
    pack = `${pack.slice(0, MAX_PACK)}…`;
  }
  return pack;
}

function formatMinor(balanceMinor: number, currency: string): string {
  const major = (balanceMinor / 100).toFixed(2);
  return `${major} ${currency}`;
}
