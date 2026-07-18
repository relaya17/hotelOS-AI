import { useEffect, useState } from "react";
import { Button } from "@hotelos/ui";
import {
  decideAiApproval,
  listPendingAiApprovals,
  type AiApprovalDto,
} from "@hotelos/web-client";

export function AiApprovalsPage() {
  const [items, setItems] = useState<readonly AiApprovalDto[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true);
    setError(undefined);
    try {
      setItems(await listPendingAiApprovals());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "שגיאה");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function decide(id: string, status: "approved" | "rejected") {
    try {
      await decideAiApproval(id, status);
      await reload();
    } catch (decideError) {
      setError(decideError instanceof Error ? decideError.message : "שגיאה");
    }
  }

  if (loading) return <p>טוען אישורי AI…</p>;

  return (
    <section className="approvals-page">
      <header>
        <h1>אישורי AI ממתינים</h1>
        <p className="muted">
          פעולות סוכנים שדורשות אישור אנושי לפני ביצוע (HITL).
        </p>
      </header>
      {error ? <p className="error">{error}</p> : null}
      {items.length === 0 ? <p>אין בקשות ממתינות.</p> : null}
      <ul className="list">
        {items.map((item) => (
          <li key={item.id}>
            <strong>{item.agentId}</strong>
            <p>{item.summaryHe}</p>
            <p className="muted">{item.reasonHe}</p>
            <div className="row">
              <Button
                type="button"
                onClick={() => void decide(item.id, "approved")}
              >
                אשר
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void decide(item.id, "rejected")}
              >
                דחה
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <style>{`
        .approvals-page{display:grid;gap:1rem;max-width:42rem}
        .approvals-page h1{font-family:var(--font-display);margin:0}
        .list{list-style:none;padding:0;display:grid;gap:1rem;margin:0}
        .list li{border:1px solid rgb(16 36 31 / 12%);border-radius:8px;padding:1rem;background:rgb(255 250 242 / 55%)}
        .row{display:flex;gap:.5rem}
        .muted{opacity:.75;margin:.35rem 0}
        .error{color:#8b1e1e}
      `}</style>
    </section>
  );
}
