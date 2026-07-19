import type { ReactNode } from "react";

export type SkipLinkProps = {
  readonly href?: string;
  readonly children?: ReactNode;
};

/** First focusable control — WCAG 2.2 / Vol. 4 §4.6. */
export function SkipLink({
  href = "#main-content",
  children = "דלג לתוכן הראשי",
}: SkipLinkProps) {
  return (
    <a className="hotelos-skip-link" href={href}>
      {children}
    </a>
  );
}
