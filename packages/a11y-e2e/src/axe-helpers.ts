import type { AxeResults } from "axe-core";

export type BlockingViolation = {
  readonly id: string;
  readonly help: string;
  readonly impact: string;
  readonly nodes: number;
};

/** Matches packages/ui axe smoke — block serious/critical only. */
export function listBlockingViolations(
  results: AxeResults,
): readonly BlockingViolation[] {
  return results.violations
    .filter(
      (violation) =>
        violation.impact === "critical" || violation.impact === "serious",
    )
    .map((violation) => ({
      id: violation.id,
      help: violation.help,
      impact: violation.impact ?? "unknown",
      nodes: violation.nodes.length,
    }));
}

export function formatBlockingViolations(
  violations: readonly BlockingViolation[],
): string {
  return violations
    .map((v) => `${v.id} (${v.impact}, ${v.nodes} nodes): ${v.help}`)
    .join("\n");
}

/** Include sample CSS selectors when present (axe node targets). */
export function formatBlockingViolationsDetailed(
  results: AxeResults,
): string {
  return results.violations
    .filter(
      (violation) =>
        violation.impact === "critical" || violation.impact === "serious",
    )
    .map((violation) => {
      const samples = violation.nodes
        .slice(0, 4)
        .map((node) => node.target.join(" "))
        .join(" · ");
      return `${violation.id} (${violation.impact}, ${violation.nodes.length} nodes): ${violation.help}${samples ? `\n  → ${samples}` : ""}`;
    })
    .join("\n");
}
