import { useState, type FormEvent } from "react";
import { Button, TextField } from "@hotelos/ui";
import { login } from "./api-client.js";
import { saveSession, type StoredUser } from "./session.js";

const DEMO_TENANT_ID = "11111111-1111-4111-8111-111111111111";

export type LoginPageProps = {
  readonly onLoggedIn: (user: StoredUser) => void;
};

export function LoginPage({ onLoggedIn }: LoginPageProps) {
  const [email, setEmail] = useState("admin@demo.hotelos.local");
  const [password, setPassword] = useState("HotelOS-Demo-ChangeMe1!");
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      const result = await login({
        tenantId: DEMO_TENANT_ID,
        email,
        password,
      });
      const user: StoredUser = {
        id: result.user.id,
        email: result.user.email,
        displayName: result.user.displayName,
        roles: result.user.roles,
        tenantId: result.user.scope.tenantId,
        ...(result.user.scope.hotelId !== undefined
          ? { hotelId: result.user.scope.hotelId }
          : {}),
      };
      saveSession({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user,
      });
      onLoggedIn(user);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "שגיאה לא צפויה";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <a className="skip-link" href="#content">
        דלג לתוכן
      </a>

      <section className="hero" aria-labelledby="brand">
        <p className="eyebrow">HotelOS AI</p>
        <h1 id="brand">HotelOS AI</h1>
        <p className="lede">
          שכבת האינטליגנציה לרשתות מלונות — התחברו כדי לנהל נכס, צוות והחלטות.
        </p>
      </section>

      <section id="content" className="panel" aria-labelledby="login-title">
        <form className="form" onSubmit={onSubmit} noValidate>
          <h2 id="login-title">כניסת מנהלים</h2>
          <TextField
            label="אימייל"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            required
          />
          <TextField
            label="סיסמה"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            required
            {...(error !== undefined ? { error } : {})}
          />
          <Button type="submit" disabled={loading}>
            {loading ? "מתחבר…" : "התחברות"}
          </Button>
        </form>
      </section>

      <style>{sharedAuthStyles}</style>
    </main>
  );
}

const sharedAuthStyles = `
  .shell {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 1.1fr 0.9fr;
    gap: var(--space-6);
    padding: clamp(1.5rem, 4vw, 4rem);
    align-items: center;
  }
  .skip-link {
    position: absolute;
    inset-inline-start: var(--space-4);
    top: var(--space-4);
    transform: translateY(-220%);
    background: var(--color-paper-elevated);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
  }
  .skip-link:focus {
    transform: translateY(0);
  }
  .eyebrow {
    margin: 0 0 var(--space-3);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-size: var(--text-small);
    color: var(--color-sea-deep);
    font-weight: 700;
  }
  .hero h1 {
    font-size: var(--text-display);
    max-width: 8ch;
  }
  .lede {
    margin: var(--space-4) 0 0;
    max-width: 34ch;
    font-size: 1.15rem;
    color: var(--color-ink-soft);
  }
  .panel {
    background: rgb(255 250 242 / 88%);
    border: 1px solid rgb(16 36 31 / 10%);
    border-radius: calc(var(--radius-md) + 0.15rem);
    box-shadow: var(--shadow-soft);
    padding: clamp(1.4rem, 3vw, 2.2rem);
    backdrop-filter: blur(8px);
    animation: rise 420ms ease both;
  }
  .form {
    display: grid;
    gap: var(--space-4);
  }
  .form h2 {
    font-size: var(--text-title);
  }
  @keyframes rise {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @media (max-width: 900px) {
    .shell { grid-template-columns: 1fr; align-content: start; }
    .hero h1 { max-width: none; }
  }
`;
