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
        className="hotelos-field__input hotelos-field-control"
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
          letter-spacing: 0.01em;
          color: var(--color-ink-soft);
        }
        .hotelos-field__input {
          background: #fff;
        }
        .hotelos-field__error {
          color: var(--color-danger);
          font-size: var(--text-small);
          font-weight: 500;
        }
      `}</style>
    </label>
  );
}
