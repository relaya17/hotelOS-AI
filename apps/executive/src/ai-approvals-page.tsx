import { useEffect, useState } from "react";
import { Button } from "@hotelos/ui";
import {
  decideAiApproval,
  fetchApprovalKashrutGate,
  listHotels,
  listPendingAiApprovals,
  suggestAutonomyDepartmentTask,
  type AiApprovalDto,
  type ApprovalActDto,
  type HotelDto,
  type KashrutProcurementGateDto,
} from "@hotelos/web-client";

function actMessage(act: ApprovalActDto): string {
  if (act.status === "executed") return act.summaryHe;
  return act.reasonHe;
}

export function AiApprovalsPage() {
  const [items, setItems] = useState<readonly AiApprovalDto[]>([]);
  const [hotels, setHotels] = useState<readonly HotelDto[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("ניקוי דחוף לחדר");
  const [description, setDescription] = useState(
    "הצעת סוכן — לשבץ ניקוי דחוף לפני צ'ק-אין.",
  );
  const [departmentCode, setDepartmentCode] = useState("housekeeping");
  const [hotelId, setHotelId] = useState("");
  const [gateById, setGateById] = useState<
    Record<string, KashrutProcurementGateDto | undefined>
  >({});
  const [ackById, setAckById] = useState<Record<string, boolean>>({});
  const [overrideById, setOverrideById] = useState<Record<string, boolean>>({});

  async function reload() {
    setLoading(true);
    setError(undefined);
    try {
      const [approvals, hotelList] = await Promise.all([
        listPendingAiApprovals(),
        listHotels(),
      ]);
      setItems(approvals);
      setHotels(hotelList);
      setHotelId((current) => current || hotelList[0]?.id || "");
      const gates: Record<string, KashrutProcurementGateDto | undefined> = {};
      await Promise.all(
        approvals.map(async (item) => {
          try {
            gates[item.id] = await fetchApprovalKashrutGate(item.id);
          } catch {
            gates[item.id] = undefined;
          }
        }),
      );
      setGateById(gates);
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
      const gate = gateById[id];
      const result = await decideAiApproval(
        id,
        status,
        status === "approved" && gate?.applies
          ? {
              ...(gate.requiresAck
                ? { kashrutAcknowledged: !!ackById[id] }
                : {}),
              ...(gate.requiresOverrideBlock
                ? { kashrutOverrideBlock: !!overrideById[id] }
                : {}),
            }
          : undefined,
      );
      setNotice(actMessage(result.act));
      await reload();
    } catch (decideError) {
      setError(decideError instanceof Error ? decideError.message : "שגיאה");
    }
  }

  async function suggest() {
    if (!hotelId) {
      setError("בחרו מלון");
      return;
    }
    try {
      setError(undefined);
      const created = await suggestAutonomyDepartmentTask({
        hotelId,
        departmentCode,
        taskType: "ai_suggested_task",
        title,
        description,
        priority: "high",
        agentId:
          departmentCode === "housekeeping"
            ? "agent.housekeeping"
            : "agent.cio",
      });
      setNotice(`Suggest נשלח לאישור (${created.approvalId.slice(0, 8)}…)`);
      await reload();
    } catch (suggestError) {
      setError(suggestError instanceof Error ? suggestError.message : "שגיאה");
    }
  }

  if (loading) return <p>טוען אישורי AI…</p>;

  return (
    <section className="approvals-page">
      <header>
        <h1>אישורי AI ממתינים</h1>
        <p className="muted">
          Suggest → Approve → Act. רכש מזון במלון כשר עובר שער Kashrut לפני Act.
        </p>
      </header>
      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="notice">{notice}</p> : null}

      <div className="suggest">
        <h2>Suggest — הצעת משימה</h2>
        <label>
          מלון
          <select
            value={hotelId}
            onChange={(e) => setHotelId(e.target.value)}
          >
            {hotels.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          מחלקה
          <select
            value={departmentCode}
            onChange={(e) => setDepartmentCode(e.target.value)}
          >
            <option value="housekeeping">משק בית</option>
            <option value="maintenance">תחזוקה</option>
            <option value="front_office">קבלה</option>
            <option value="procurement">רכש</option>
            <option value="sales_marketing">מכירות</option>
          </select>
        </label>
        <label>
          כותרת
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          תיאור
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </label>
        <Button type="button" onClick={() => void suggest()}>
          שלח להצעה (Suggest)
        </Button>
      </div>

      {items.length === 0 ? <p>אין בקשות ממתינות.</p> : null}
      <ul className="list">
        {items.map((item) => {
          const gate = gateById[item.id];
          return (
            <li key={item.id}>
              <strong>{item.agentId}</strong>
              <p>{item.summaryHe}</p>
              <p className="muted">{item.reasonHe}</p>
              {gate?.applies ? (
                <div className="kashrut-gate">
                  <p>{gate.gateHe}</p>
                  {gate.requiresAck ? (
                    <label className="ack">
                      <input
                        type="checkbox"
                        checked={!!ackById[item.id]}
                        onChange={(e) =>
                          setAckById((prev) => ({
                            ...prev,
                            [item.id]: e.target.checked,
                          }))
                        }
                      />
                      אישור מודע לבדיקת כשרות
                    </label>
                  ) : null}
                  {gate.requiresOverrideBlock ? (
                    <label className="ack">
                      <input
                        type="checkbox"
                        checked={!!overrideById[item.id]}
                        onChange={(e) =>
                          setOverrideById((prev) => ({
                            ...prev,
                            [item.id]: e.target.checked,
                          }))
                        }
                      />
                      דריסת block
                    </label>
                  ) : null}
                </div>
              ) : null}
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
          );
        })}
      </ul>
      <style>{`
        .approvals-page{display:grid;gap:var(--space-4);max-width:42rem;animation:hotelos-enter var(--motion-med) var(--ease-out) both}
        .approvals-page h1,.approvals-page h2{margin:0}
        .list{list-style:none;padding:0;display:grid;gap:var(--space-3);margin:0}
        .list li{border:1px solid var(--color-line);border-radius:var(--radius-md);padding:var(--space-4);background:var(--color-paper-elevated);display:grid;gap:var(--space-2);box-shadow:var(--shadow-soft)}
        .row{display:flex;flex-wrap:wrap;gap:var(--space-2)}
        .muted{margin:.35rem 0;color:var(--color-ink-soft);font-weight:500}
        .error{color:var(--color-danger)}
        .notice{color:var(--color-sea-deep);background:var(--color-sea-soft);padding:var(--space-3);border-radius:var(--radius-sm);border:1px solid rgb(14 107 92 / 16%);font-weight:500}
        .suggest{display:grid;gap:var(--space-3);border:1px dashed var(--color-line-strong);padding:var(--space-4);border-radius:var(--radius-md);background:rgb(12 31 26 / 2%)}
        .suggest label{display:grid;gap:.25rem;font-size:var(--text-small);font-weight:600;color:var(--color-ink-soft)}
        .suggest input,.suggest select,.suggest textarea{font:inherit;padding:.55rem .7rem;border:1px solid var(--color-line-strong);border-radius:var(--radius-sm);background:#fff}
        .kashrut-gate{border:1px dashed var(--color-line-strong);padding:var(--space-3);border-radius:var(--radius-md);display:grid;gap:var(--space-2);background:rgb(12 31 26 / 2%)}
        .ack{display:flex;gap:var(--space-2);align-items:flex-start;font-size:var(--text-small)}
      `}</style>
    </section>
  );
}
