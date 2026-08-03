import {
  IncidentCenterPanel,
  PredictiveMaintenancePanel,
} from "@hotelos/features";

export function IncidentCenterPage() {
  return (
    <div className="incidents-layout">
      <div className="incidents-main">
        <IncidentCenterPanel />
      </div>
      <section className="card pm-adjacent" aria-labelledby="pm-incidents-heading">
        <PredictiveMaintenancePanel />
      </section>
      <style>{`
        .incidents-layout { display:grid; gap:1.25rem; }
        @media (min-width: 960px) {
          .incidents-layout { grid-template-columns: 1.4fr 1fr; align-items:start; }
        }
        .pm-adjacent { border-color: var(--color-line-strong); }
      `}</style>
    </div>
  );
}
