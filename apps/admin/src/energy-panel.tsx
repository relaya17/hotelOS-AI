import { useEffect, useState } from "react";
import { Button } from "@hotelos/ui";
import {
  decideEnergySuggestion,
  fetchEnergySuggestions,
  generateEnergySuggestions,
  type EnergySuggestionDto,
} from "@hotelos/web-client";

export type EnergyPanelProps = {
  readonly hotelId: string;
};

export function EnergyPanel({ hotelId }: EnergyPanelProps) {
  const [suggestions, setSuggestions] = useState<
    readonly EnergySuggestionDto[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(undefined);
      try {
        const rows = await fetchEnergySuggestions(hotelId);
        if (!cancelled) setSuggestions(rows);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "שגיאה בטעינה",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  async function onGenerate() {
    setLoading(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const result = await generateEnergySuggestions(hotelId);
      setSuggestions(result.suggestions);
      setNotice(`נוצרו ${result.suggestions.length} הצעות אנרגיה ל-${result.periodDate}.`);
    } catch (genError) {
      setError(
        genError instanceof Error ? genError.message : "יצירת הצעות נכשלה",
      );
    } finally {
      setLoading(false);
    }
  }

  async function onDecide(
    suggestionId: string,
    decision: "accepted" | "dismissed",
  ) {
    setBusyId(suggestionId);
    setError(undefined);
    try {
      const updated = await decideEnergySuggestion(
        hotelId,
        suggestionId,
        decision,
      );
      setSuggestions((prev) =>
        prev.map((row) => (row.id === updated.id ? updated : row)),
      );
      setNotice(
        decision === "accepted"
          ? "הצעת אנרגיה אושרה — אין שליטה BMS אוטומטית."
          : "הצעת אנרגיה נדחתה.",
      );
    } catch (decideError) {
      setError(
        decideError instanceof Error ? decideError.message : "עדכון סטטוס נכשל",
      );
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <section className="card energy-card" aria-labelledby="energy-panel-heading">
      <h2 id="energy-panel-heading">אנרגיה</h2>
      <p className="hint">
        HVAC וחשמל לפי תפוסה — הצעות יומיות; אין חיבור BMS חובה.
      </p>
      <Button type="button" onClick={() => void onGenerate()} disabled={loading}>
        {loading ? "מחשב…" : "צור הצעות אנרגיה"}
      </Button>
      {notice !== undefined ? <p className="hint">{notice}</p> : null}
      {error !== undefined ? (
        <p className="state state--error" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && suggestions.length === 0 ? (
        <p className="hint">אין הצעות שמורות.</p>
      ) : null}
      {suggestions.length > 0 ? (
        <ul className="energy-list">
          {suggestions.map((row) => (
            <li key={row.id} className="energy-row">
              <div>
                <strong>
                  {row.periodDate} · תפוסה {row.occupancyPct}%
                  {row.estimatedSavingPct > 0
                    ? ` · חיסכון ~${row.estimatedSavingPct}%`
                    : ""}
                </strong>
                <span>{row.suggestionHe}</span>
                <span className="badge">סטטוס: {row.status}</span>
              </div>
              {row.status === "suggested" ? (
                <div className="energy-actions">
                  <Button
                    type="button"
                    onClick={() => void onDecide(row.id, "accepted")}
                    disabled={busyId === row.id}
                  >
                    אשר
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void onDecide(row.id, "dismissed")}
                    disabled={busyId === row.id}
                  >
                    דחה
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
