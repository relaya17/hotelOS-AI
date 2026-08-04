import type { ReactNode } from "react";

export type CitationListItem = {
  readonly title: string;
  readonly url?: string;
  readonly source: "internal" | "trusted" | "company";
  readonly snippet?: string;
};

export type CitationListProps = {
  readonly citations: readonly CitationListItem[];
  readonly label?: string;
  readonly empty?: ReactNode;
};

const SOURCE_LABEL_HE: Record<CitationListItem["source"], string> = {
  company: "ארגון",
  trusted: "אמין",
  internal: "פנימי",
};

/**
 * Structured AI citations (Vol. 4 §AI components / Engineering Standard).
 * Render Gateway or pack citations without inventing sources.
 */
export function CitationList({
  citations,
  label = "ציטוטים",
  empty = null,
}: CitationListProps) {
  if (citations.length === 0) {
    return empty ? <>{empty}</> : null;
  }

  return (
    <ul className="hotelos-citation-list" aria-label={label}>
      {citations.map((cite) => (
        <li
          key={`${cite.source}-${cite.title}-${cite.url ?? ""}-${cite.snippet?.slice(0, 24) ?? ""}`}
          className="hotelos-citation"
        >
          <span
            className={`hotelos-citation__chip hotelos-citation__chip--${cite.source}`}
          >
            {SOURCE_LABEL_HE[cite.source]}
          </span>
          {cite.url ? (
            <a href={cite.url} target="_blank" rel="noreferrer">
              {cite.title}
            </a>
          ) : (
            <span className="hotelos-citation__title">{cite.title}</span>
          )}
          {cite.snippet ? (
            <span className="hotelos-citation__snippet"> — {cite.snippet}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
