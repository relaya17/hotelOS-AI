import { useEffect, useState } from "react";
import { tUi, type LocaleCode } from "@hotelos/i18n";
import { fetchAccounting, type AccountingDto } from "@hotelos/web-client";

export type TurboAccountingPageProps = {
  readonly locale: LocaleCode;
};

function formatMoney(minor: number, currency: string): string {
  return `${(minor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
  })} ${currency}`;
}

export function TurboAccountingPage({ locale }: TurboAccountingPageProps) {
  const [data, setData] = useState<AccountingDto | null>(null);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const next = await fetchAccounting();
        if (!cancelled) setData(next);
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
        .card{background:rgb(255 250 242 / 92%);border:1px solid rgb(16 36 31 / 10%);border-radius:var(--radius-md);padding:var(--space-4);box-shadow:var(--shadow-soft)}
        .card h2{margin:0 0 var(--space-3);font-size:1.2rem}
        .hint{color:var(--color-ink-soft);font-size:var(--text-small)}
        .table{list-style:none;margin:0;padding:0;display:grid;gap:var(--space-2)}
        .table li{display:grid;gap:.2rem;padding:var(--space-3);border:1px solid rgb(16 36 31 / 8%);border-radius:var(--radius-sm);background:var(--color-paper-elevated)}
        .table span{color:var(--color-ink-soft);font-size:var(--text-small)}
        code{font-size:.85em;background:rgb(15 106 92 / 10%);padding:.1rem .35rem;border-radius:.25rem;margin-inline-end:.35rem}
        .err{color:var(--color-danger)}
      `}</style>
    </div>
  );
}
