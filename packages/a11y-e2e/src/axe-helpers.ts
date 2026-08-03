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
