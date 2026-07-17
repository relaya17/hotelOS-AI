import type { InputHTMLAttributes } from "react";

export type TextFieldProps = {
  readonly label: string;
  readonly error?: string;
} & InputHTMLAttributes<HTMLInputElement>;

export function TextField({
  label,
  error,
  id,
  ...rest
}: TextFieldProps) {
  const fieldId = id ?? rest.name;
  const errorId = error && fieldId ? `${fieldId}-error` : undefined;

  return (
    <label className="hotelos-field" htmlFor={fieldId}>
      <span className="hotelos-field__label">{label}</span>
      <input
        id={fieldId}
        className="hotelos-field__input"
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        {...rest}
      />
      {error ? (
        <span id={errorId} className="hotelos-field__error" role="alert">
          {error}
        </span>
      ) : null}
      <style>{`
        .hotelos-field {
          display: grid;
          gap: var(--space-2);
        }
        .hotelos-field__label {
          font-size: var(--text-small);
          font-weight: 600;
          color: var(--color-ink-soft);
        }
        .hotelos-field__input {
          font: inherit;
          border: 1px solid rgb(16 36 31 / 18%);
          border-radius: var(--radius-sm);
          padding: 0.85rem 0.95rem;
          background: var(--color-paper-elevated);
          color: var(--color-ink);
        }
        .hotelos-field__error {
          color: var(--color-danger);
          font-size: var(--text-small);
        }
      `}</style>
    </label>
  );
}
