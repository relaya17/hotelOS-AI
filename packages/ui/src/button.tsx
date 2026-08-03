import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonProps = {
  readonly children: ReactNode;
  readonly variant?: "primary" | "ghost";
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  children,
  variant = "primary",
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`hotelos-button hotelos-button--${variant}`}
      {...rest}
    >
      {children}
      <style>{`
        .hotelos-button {
          font-family: var(--font-body);
          font-size: var(--text-small);
          font-weight: 600;
          letter-spacing: 0.01em;
          border-radius: var(--radius-sm);
          border: 1px solid transparent;
          padding: 0.75rem 1.15rem;
          min-height: var(--touch-min, 2.75rem);
          cursor: pointer;
          transition:
            transform var(--motion-fast),
            background var(--motion-fast),
            border-color var(--motion-fast),
            box-shadow var(--motion-fast);
        }
        .hotelos-button:active:not(:disabled) {
          transform: translateY(1px);
        }
        .hotelos-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .hotelos-button--primary {
          background: var(--color-sea);
          color: #f7fffc;
          box-shadow: 0 1px 0 rgb(255 255 255 / 14%) inset, var(--shadow-soft);
        }
        .hotelos-button--primary:hover:not(:disabled) {
          background: var(--color-sea-deep);
          box-shadow: var(--shadow-lift);
          transform: translateY(-1px);
        }
        .hotelos-button--ghost {
          background: rgb(255 255 255 / 70%);
          border-color: var(--color-line-strong);
          color: var(--color-ink);
        }
        .hotelos-button--ghost:hover:not(:disabled) {
          border-color: rgb(14 107 92 / 28%);
          background: var(--color-sea-soft);
        }
      `}</style>
    </button>
  );
}
