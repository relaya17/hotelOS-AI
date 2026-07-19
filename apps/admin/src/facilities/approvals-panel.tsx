import { useEffect, useState } from "react";
import { Button } from "@hotelos/ui";
import {
  decideAiApproval,
  listPendingAiApprovals,
  type AiApprovalDto,
  type ApprovalActDto,
} from "@hotelos/web-client";

function actMessage(act: ApprovalActDto): string {
  if (act.status === "executed") return act.summaryHe;
  return act.reasonHe;
}

export function ApprovalsPanel() {
  const [items, setItems] = useState<readonly AiApprovalDto[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
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
      const result = await decideAiApproval(id, status);
      setNotice(actMessage(result.act));
      await reload();
    } catch (decideError) {
      setError(decideError instanceof Error ? decideError.message : "שגיאה");
    }
  }

  if (loading) return <p>טוען אישורים…</p>;

  return (
    <section>
      <h2>תיבת אישורי AI</h2>
      <p className="muted">
        Approve מפעיל Act בטוח (משימת מחלקה) — לא שינוי מחיר/כסף.
      </p>
      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="notice">{notice}</p> : null}
      {items.length === 0 ? <p>אין בקשות ממתינות.</p> : null}
      <ul className="approvals">
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
                אשר → Act
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
        .approvals{list-style:none;padding:0;display:grid;gap:1rem}
        .approvals li{border:1px solid rgb(16 36 31 / 12%);border-radius:8px;padding:1rem}
        .row{display:flex;gap:.5rem}
        .muted{opacity:.75}
        .error{color:#8b1e1e}
        .notice{color:#1a5c45;background:rgb(26 92 69 / 8%);padding:.65rem;border-radius:8px}
      `}</style>
    </section>
  );
}
