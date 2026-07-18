import { useState, type FormEvent } from "react";
import { Button, TextField } from "@hotelos/ui";
import {
  runRevenueSimulator,
  type RevenueSimulatorRunDto,
} from "@hotelos/web-client";

export type SimulatorPanelProps = {
  readonly hotelId: string;
};

export function SimulatorPanel({ hotelId }: SimulatorPanelProps) {
  const [adrChangePercent, setAdrChangePercent] = useState("15");
  const [baseAdr, setBaseAdr] = useState("850");
  const [nights, setNights] = useState("1");
  const [result, setResult] = useState<RevenueSimulatorRunDto | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  async function onRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      const data = await runRevenueSimulator({
        hotelId,
        adrChangePercent: Number(adrChangePercent),
        baseAdr: Number(baseAdr),
        nights: Number(nights),
      });
      setResult(data);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "סימולציה נכשלה");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="sim">
      <h2>AI Simulator · הכנסות</h2>
      <p className="muted">
        What-if על ADR/תפוסה/RevPAR — מדמה בלבד, לא משנה מחירים (Vol. 5A.10).
      </p>
      {error ? <p className="error">{error}</p> : null}

      <form className="stack" onSubmit={(e) => void onRun(e)}>
        <TextField
          label="שינוי ADR (%)"
          type="number"
          value={adrChangePercent}
          onChange={(e) => setAdrChangePercent(e.target.value)}
          required
        />
        <TextField
          label="ADR בסיס משוער"
          type="number"
          value={baseAdr}
          onChange={(e) => setBaseAdr(e.target.value)}
          required
        />
        <TextField
          label="לילות"
          type="number"
          value={nights}
          onChange={(e) => setNights(e.target.value)}
          required
        />
        <Button type="submit" disabled={loading}>
          {loading ? "מריץ…" : "הרץ סימולציה"}
        </Button>
      </form>

      {result ? (
        <div className="result">
          <p>
            <strong>{result.simulation.hotelName}</strong>
            {result.simulation.requiresHumanApproval
              ? " · דורש אישור אנושי לפני Act"
              : " · מתחת לסף אישור"}
          </p>
          {result.approvalId ? (
            <p className="muted">נוצרה בקשת אישור: {result.approvalId}</p>
          ) : null}
          <div className="cols">
            <div>
              <h3>{result.simulation.baseline.labelHe}</h3>
              <ul>
                <li>ADR {result.simulation.baseline.adr}</li>
                <li>תפוסה {result.simulation.baseline.occupancyPct}%</li>
                <li>RevPAR {result.simulation.baseline.revpar}</li>
                <li>
                  הכנסה משוערת{" "}
                  {result.simulation.baseline.estimatedRoomRevenue}{" "}
                  {result.simulation.currency}
                </li>
              </ul>
            </div>
            <div>
              <h3>{result.simulation.proposed.labelHe}</h3>
              <ul>
                <li>ADR {result.simulation.proposed.adr}</li>
                <li>תפוסה {result.simulation.proposed.occupancyPct}%</li>
                <li>RevPAR {result.simulation.proposed.revpar}</li>
                <li>
                  הכנסה משוערת{" "}
                  {result.simulation.proposed.estimatedRoomRevenue}{" "}
                  {result.simulation.currency}
                </li>
              </ul>
            </div>
          </div>
          <p>
            Δ ADR {result.simulation.delta.adrPct}% · Δ תפוסה{" "}
            {result.simulation.delta.occupancyPts} נק׳ · Δ הכנסה{" "}
            {result.simulation.delta.revenuePct}%
          </p>
          <pre className="narrative">{result.narrativeHe}</pre>
          <h3>הנחות</h3>
          <ul>
            {result.simulation.assumptionsHe.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <h3>סיכונים</h3>
          <ul>
            {result.simulation.risksHe.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <style>{`
        .sim .stack{display:grid;gap:.75rem;max-width:22rem}
        .sim .muted{opacity:.75}
        .sim .error{color:#8b1e1e}
        .sim .cols{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
        .sim .narrative{white-space:pre-wrap;font:inherit;background:rgb(255 250 242);padding:.75rem;border-radius:8px}
        .sim .result{display:grid;gap:.75rem;margin-top:1rem}
        @media (max-width:700px){.sim .cols{grid-template-columns:1fr}}
      `}</style>
    </section>
  );
}
