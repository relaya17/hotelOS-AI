import { useEffect, useState } from "react";
import { Button } from "@hotelos/ui";
import { tUi, type LocaleCode } from "@hotelos/i18n";
import {
  fetchAccounting,
  listHotels,
  suggestAutonomyLedgerClose,
  type AccountingDto,
  type HotelDto,
} from "@hotelos/web-client";

export type TurboAccountingPageProps = {
  readonly locale: LocaleCode;
};

function formatMoney(minor: number, currency: string): string {
  return `${(minor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
  })} ${currency}`;
}

/** Previous calendar month key (YYYY-MM), e.g. run in August → "2026-07". */
function previousCalendarMonthKey(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-based; -1 = previous month
  const previous = new Date(Date.UTC(year, month - 1, 1));
  const yyyy = previous.getUTCFullYear();
  const mm = String(previous.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

export function TurboAccountingPage({ locale }: TurboAccountingPageProps) {
  const [data, setData] = useState<AccountingDto | null>(null);
  const [hotels, setHotels] = useState<readonly HotelDto[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [next, hotelRows] = await Promise.all([
          fetchAccounting(),
          listHotels(),
        ]);
        if (!cancelled) {
          setData(next);
          setHotels(hotelRows);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Load failed",
          );
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const primaryHotelId = hotels[0]?.id;
  const periodKey = previousCalendarMonthKey();

  async function handleSuggestLedgerClose() {
    if (!primaryHotelId) return;
    try {
      setBusy(true);
      setError(undefined);
      setNotice(undefined);
      const result = await suggestAutonomyLedgerClose({
        hotelId: primaryHotelId,
        periodKey,
      });
      setNotice(
        `Suggest נשלח: סגירת ${result.periodKey} · ממתין לאישור רואה חשבון/CFO (${result.approvalId.slice(0, 8)}…).`,
      );
    } catch (suggestError) {
      setError(
        suggestError instanceof Error
          ? suggestError.message
          : "שליחת Suggest נכשלה",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header>
        <p className="eyebrow">Turbo OS · Accounting</p>
        <h1>{tUi(locale, "accounting.title")}</h1>
        <p className="sub">{tUi(locale, "accounting.subtitle")}</p>
      </header>

      {error !== undefined ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : null}
      {notice !== undefined ? (
        <p className="notice" role="status">
          {notice}
        </p>
      ) : null}

      <section className="card">
        <h2>סגירת ספרים חודשית (stage ז׳)</h2>
        <p className="hint">
          HITL מלא — הסוכן (agent.cfo) רק מציע; רואה חשבון/CFO חייב לאשר
          לפני סגירה בפועל. אדמין בלבד אינו מספיק.
        </p>
        <Button
          type="button"
          disabled={busy || !primaryHotelId}
          onClick={() => void handleSuggestLedgerClose()}
        >
          {busy
            ? "שולח…"
            : `הצע סגירת ${periodKey} (החודש הקודם)`}
        </Button>
      </section>

      {data ? (
        <>
          <section className="card">
            <h2>Integration</h2>
            <p>
              Internal: <code>{data.integration.internalProgram}</code>
            </p>
            <p>
              External:{" "}
              {data.integration.externalConnectors.map((item) => (
                <code key={item}>{item}</code>
              ))}
            </p>
            <p className="hint">{data.integration.note}</p>
          </section>

          <section className="card">
            <h2>Chart of accounts</h2>
            <ul className="table">
              {data.accounts.map((account) => (
                <li key={account.id}>
                  <strong>
                    {account.code} · {account.name}
                  </strong>
                  <span>
                    {account.accountType} ·{" "}
                    {formatMoney(account.balanceMinor, account.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h2>Journal</h2>
            <ul className="table">
              {data.journal.map((entry) => (
                <li key={entry.id}>
                  <strong>
                    {entry.entryDate} · {entry.accountCode} {entry.accountName}
                  </strong>
                  <span>
                    {entry.memo} · Dr {entry.debit / 100} / Cr {entry.credit / 100}{" "}
                    · {entry.sourceSystem}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      <style>{`
        .page{display:grid;gap:var(--space-4)}
        .eyebrow{margin:0 0 var(--space-2);letter-spacing:.08em;text-transform:uppercase;font-size:var(--text-small);color:var(--color-sea-deep);font-weight:700}
        h1{margin:0;font-size:clamp(1.8rem,3vw,2.6rem)}
        .sub{margin:var(--space-2) 0 0;color:var(--color-ink-soft)}
        .card{background:var(--color-paper-elevated);border:1px solid var(--color-line);border-radius:var(--radius-md);padding:var(--space-4);box-shadow:var(--shadow-soft)}
        .card h2{margin:0 0 var(--space-3);font-size:1.2rem}
        .hint{color:var(--color-ink-soft);font-size:var(--text-small)}
        .table{list-style:none;margin:0;padding:0;display:grid;gap:var(--space-2)}
        .table li{display:grid;gap:.2rem;padding:var(--space-3);border:1px solid rgb(16 36 31 / 8%);border-radius:var(--radius-sm);background:var(--color-paper-elevated)}
        .table span{color:var(--color-ink-soft);font-size:var(--text-small)}
        code{font-size:.85em;background:rgb(15 106 92 / 10%);padding:.1rem .35rem;border-radius:.25rem;margin-inline-end:.35rem}
        .err{color:var(--color-danger)}
        .notice{color:var(--color-sea-deep);font-weight:600}
      `}</style>
    </div>
  );
}
