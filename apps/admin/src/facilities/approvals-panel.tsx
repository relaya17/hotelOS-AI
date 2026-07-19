import { useEffect, useState } from "react";
import { Button } from "@hotelos/ui";
import {
  createKashrutAnnotation,
  decideAiApproval,
  fetchApprovalKashrutGate,
  listPendingAiApprovals,
  type AiApprovalDto,
  type ApprovalActDto,
  type KashrutProcurementGateDto,
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
  const [gateById, setGateById] = useState<
    Record<string, KashrutProcurementGateDto | undefined>
  >({});
  const [ackById, setAckById] = useState<Record<string, boolean>>({});
  const [overrideById, setOverrideById] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | undefined>();

  async function reload() {
    setLoading(true);
    setError(undefined);
    try {
      const list = await listPendingAiApprovals();
      setItems(list);
      const gates: Record<string, KashrutProcurementGateDto | undefined> = {};
      await Promise.all(
        list.map(async (item) => {
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
    setBusyId(id);
    setError(undefined);
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
    } finally {
      setBusyId(undefined);
    }
  }

  async function annotateOk(item: AiApprovalDto, hotelId: string | undefined) {
    if (!hotelId) {
      setError("חסר hotelId להערת כשרות — פתחו מהמלון המתאים");
      return;
    }
    setBusyId(item.id);
    try {
      await createKashrutAnnotation(hotelId, {
        targetKind: "procurement",
        targetId: item.id,
        status: "ok",
        message: "אושר ע״י משגיח/מנהל לפני Act רכש",
      });
      setGateById((prev) => ({
        ...prev,
        [item.id]: undefined,
      }));
      const gate = await fetchApprovalKashrutGate(item.id);
      setGateById((prev) => ({ ...prev, [item.id]: gate }));
      setNotice("נוספה הערת כשרות ok");
    } catch (annotateError) {
      setError(
        annotateError instanceof Error
          ? annotateError.message
          : "הוספת הערת כשרות נכשלה",
      );
    } finally {
      setBusyId(undefined);
    }
  }

  if (loading) return <p>טוען אישורים…</p>;

  return (
    <section>
      <h2>תיבת אישורי AI</h2>
      <p className="muted">
        Approve מפעיל Act בטוח. רכש מזון במלון כשר עובר שער Kashrut לפני Act.
      </p>
      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="notice">{notice}</p> : null}
      {items.length === 0 ? <p>אין בקשות ממתינות.</p> : null}
      <ul className="approvals">
        {items.map((item) => {
          const gate = gateById[item.id];
          return (
            <li key={item.id}>
              <strong>{item.agentId}</strong>
              <p>{item.summaryHe}</p>
              <p className="muted">{item.reasonHe}</p>
              {gate?.applies ? (
                <div className="kashrut-gate">
                  <p>
                    <strong>שער כשרות:</strong> {gate.gateHe}
                  </p>
                  {gate.latestStatus ? (
                    <p className="muted">
                      סטטוס אחרון: {gate.latestStatus}
                      {gate.latestMessageHe
                        ? ` — ${gate.latestMessageHe}`
                        : ""}
                    </p>
                  ) : (
                    <p className="muted">אין הערת Kashrut עדיין על בקשה זו.</p>
                  )}
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
                      אני מאשר/ת בדיקת כשרות לפני יצירת טיוטת PO
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
                      דריסת block ע״י משגיח/הנהלה (חריג)
                    </label>
                  ) : null}
                  {item.hotelId ? (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busyId === item.id}
                      onClick={() => void annotateOk(item, item.hotelId ?? undefined)}
                    >
                      הוסף הערת כשרות ok
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <div className="row">
                <Button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => void decide(item.id, "approved")}
                >
                  אשר → Act
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busyId === item.id}
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
        .approvals{list-style:none;padding:0;display:grid;gap:1rem}
        .approvals li{border:1px solid rgb(16 36 31 / 12%);border-radius:8px;padding:1rem;display:grid;gap:.5rem}
        .row{display:flex;gap:.5rem}
        .muted{opacity:.75}
        .error{color:#8b1e1e}
        .notice{color:#1a5c45;background:rgb(26 92 69 / 8%);padding:.65rem;border-radius:8px}
        .kashrut-gate{border:1px dashed rgb(16 36 31 / 22%);border-radius:8px;padding:.75rem;display:grid;gap:.4rem;background:rgb(255 250 242 / 55%)}
        .ack{display:flex;gap:.5rem;align-items:flex-start;font-size:.9rem}
      `}</style>
    </section>
  );
}
