import { useCallback, useEffect, useMemo, useState } from "react";
import {
  APP_URLS,
  decideMaintenancePrediction,
  fetchEquipmentAssets,
  fetchMaintenancePredictions,
  runPredictiveMaintenanceScan,
  type EquipmentAssetDto,
  type MaintenancePredictionDto,
} from "@hotelos/web-client";

export type PredictiveMaintenancePanelProps = {
  /** When set, scope to one hotel (admin). Omit for chain view (executive). */
  readonly hotelId?: string;
  /** Compact layout for admin maintenance tab. */
  readonly compact?: boolean;
};

const STATUS_LABEL: Record<MaintenancePredictionDto["status"], string> = {
  open: "פתוח",
  acknowledged: "אושר לטיפול",
  dismissed: "נדחה",
  converted: "הומר למשימה",
};

function riskClass(score: number): string {
  if (score >= 80) return "pm-risk pm-risk--critical";
  if (score >= 70) return "pm-risk pm-risk--high";
  if (score >= 50) return "pm-risk pm-risk--medium";
  return "pm-risk pm-risk--low";
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stripFingerprint(text: string): string {
  return text.replace(/^\[pm:[^\]]+\]\n?/, "");
}

export function PredictiveMaintenancePanel({
  hotelId: fixedHotelId,
  compact = false,
}: PredictiveMaintenancePanelProps) {
  const [predictions, setPredictions] = useState<
    readonly MaintenancePredictionDto[]
  >([]);
  const [assets, setAssets] = useState<readonly EquipmentAssetDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [actionId, setActionId] = useState<string | undefined>();

  const scopedHotelId = fixedHotelId;

  const assetById = useMemo(() => {
    const map = new Map<string, EquipmentAssetDto>();
    for (const asset of assets) {
      map.set(asset.id, asset);
    }
    return map;
  }, [assets]);

  const load = useCallback(async () => {
    if (!scopedHotelId) {
      setPredictions([]);
      setAssets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const [predictionRows, assetRows] = await Promise.all([
        fetchMaintenancePredictions(scopedHotelId),
        fetchEquipmentAssets(scopedHotelId),
      ]);
      setPredictions(
        predictionRows.filter(
          (row) => row.status === "open" || row.status === "acknowledged",
        ),
      );
      setAssets(assetRows);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "שגיאה בטעינת תחזוקה חזויה",
      );
    } finally {
      setLoading(false);
    }
  }, [scopedHotelId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleScan() {
    if (!scopedHotelId) return;
    setScanning(true);
    setError(undefined);
    try {
      await runPredictiveMaintenanceScan(scopedHotelId);
      await load();
    } catch (scanError) {
      setError(
        scanError instanceof Error ? scanError.message : "שגיאה בסריקת חיזוי",
      );
    } finally {
      setScanning(false);
    }
  }

  async function handleDecide(
    predictionId: string,
    status: "acknowledged" | "dismissed",
  ) {
    if (!scopedHotelId) return;
    setActionId(predictionId);
    setError(undefined);
    try {
      await decideMaintenancePrediction(scopedHotelId, predictionId, status);
      await load();
    } catch (decideError) {
      setError(
        decideError instanceof Error ? decideError.message : "שגיאה בעדכון סטטוס",
      );
    } finally {
      setActionId(undefined);
    }
  }

  if (!scopedHotelId) {
    return (
      <section
        className={`pm-panel${compact ? " pm-panel--compact" : ""}`}
        aria-labelledby="pm-heading"
      >
        <h2 id="pm-heading">תחזוקה חזויה</h2>
        <p className="hint">בחר מלון כדי לצפות בחיזויי תחזוקה.</p>
      </section>
    );
  }

  return (
    <section
      className={`pm-panel${compact ? " pm-panel--compact" : ""}`}
      aria-labelledby="pm-heading"
    >
      <header className="pm-panel__header">
        <div>
          <h2 id="pm-heading">תחזוקה חזויה</h2>
          <p className="hint">
            חוקים על היסטוריית תחזוקה + אותות חיישן (webhook) — ללא IoT חי.
          </p>
        </div>
        <button
          type="button"
          className="pm-scan-btn"
          onClick={() => void handleScan()}
          disabled={scanning || loading}
          aria-busy={scanning}
        >
          {scanning ? "סורק…" : "הרץ סריקה"}
        </button>
      </header>

      {loading ? <p className="state">טוען חיזויים…</p> : null}
      {error !== undefined ? (
        <p className="state state--error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && predictions.length === 0 ? (
        <p className="hint">
          אין חיזויים פתוחים. הוסף נכסים, שלח אותות webhook או הרץ סריקה.
        </p>
      ) : null}

      {!loading && predictions.length > 0 ? (
        <ul className="pm-list" aria-label="רשימת חיזויי תחזוקה">
          {predictions.map((prediction) => {
            const asset = assetById.get(prediction.assetId);
            const taskLink =
              prediction.taskId !== null
                ? `${APP_URLS.admin}?hotelId=${encodeURIComponent(scopedHotelId)}&panel=maintenance`
                : null;
            return (
              <li key={prediction.id} className="pm-item">
                <div className="pm-item__top">
                  <span className={riskClass(prediction.riskScore)}>
                    {prediction.riskScore}/100
                  </span>
                  <span className="pm-status">
                    {STATUS_LABEL[prediction.status]}
                  </span>
                  <time dateTime={prediction.createdAt}>
                    {formatWhen(prediction.createdAt)}
                  </time>
                </div>
                <p className="pm-item__asset">
                  {asset?.nameHe ?? prediction.assetId}
                  {asset !== undefined ? (
                    <span className="pm-item__code"> · {asset.code}</span>
                  ) : null}
                </p>
                <p className="pm-item__rationale">
                  {stripFingerprint(prediction.rationaleHe)}
                </p>
                <p className="pm-item__action">
                  {prediction.recommendedActionHe}
                </p>
                <div className="pm-item__buttons">
                  {prediction.status === "open" ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          void handleDecide(prediction.id, "acknowledged")
                        }
                        disabled={actionId === prediction.id}
                      >
                        אשר לטיפול
                      </button>
                      <button
                        type="button"
                        className="pm-btn-muted"
                        onClick={() =>
                          void handleDecide(prediction.id, "dismissed")
                        }
                        disabled={actionId === prediction.id}
                      >
                        דחה
                      </button>
                    </>
                  ) : null}
                  {taskLink !== null ? (
                    <a href={taskLink}>פתח משימת תחזוקה</a>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <style>{`
        .pm-panel { display:flex; flex-direction:column; gap:0.75rem; }
        .pm-panel--compact .pm-item { padding:0.65rem; }
        .pm-panel__header { display:flex; flex-wrap:wrap; gap:0.75rem; justify-content:space-between; align-items:flex-start; }
        .pm-scan-btn { padding:0.45rem 0.85rem; border-radius:8px; border:1px solid var(--color-line-strong); background:var(--color-surface-raised); cursor:pointer; }
        .pm-scan-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .pm-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:0.65rem; }
        .pm-item { border:1px solid var(--color-line); border-radius:10px; padding:0.85rem; background:var(--color-surface); }
        .pm-item__top { display:flex; flex-wrap:wrap; gap:0.5rem; align-items:center; font-size:0.85rem; color:var(--color-text-muted); }
        .pm-risk { font-weight:700; padding:0.15rem 0.45rem; border-radius:6px; }
        .pm-risk--critical { background:#fde8e8; color:#9b1c1c; }
        .pm-risk--high { background:#fff3e0; color:#b45309; }
        .pm-risk--medium { background:#fef9c3; color:#854d0e; }
        .pm-risk--low { background:#ecfdf5; color:#047857; }
        .pm-item__asset { margin:0.35rem 0 0; font-weight:600; }
        .pm-item__code { font-weight:400; color:var(--color-text-muted); }
        .pm-item__rationale, .pm-item__action { margin:0.25rem 0 0; font-size:0.92rem; }
        .pm-item__buttons { display:flex; flex-wrap:wrap; gap:0.5rem; margin-top:0.55rem; }
        .pm-item__buttons button, .pm-item__buttons a { font-size:0.85rem; }
        .pm-btn-muted { opacity:0.85; }
        @media (max-width: 640px) {
          .pm-panel__header { flex-direction:column; }
          .pm-scan-btn { width:100%; }
        }
      `}</style>
    </section>
  );
}
