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
          font-weight: 600;
          border-radius: var(--radius-sm);
          border: 1px solid transparent;
          padding: 0.85rem 1.2rem;
          cursor: pointer;
          transition: transform var(--motion-fast), background var(--motion-fast);
        }
        .hotelos-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .hotelos-button--primary {
          background: var(--color-sea);
          color: #f7fffc;
        }
        .hotelos-button--primary:hover:not(:disabled) {
          background: var(--color-sea-deep);
          transform: translateY(-1px);
        }
        .hotelos-button--ghost {
          background: transparent;
          border-color: rgb(16 36 31 / 18%);
          color: var(--color-ink);
        }
      `}</style>
    </button>
  );
}
