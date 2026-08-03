import { useState, type FormEvent } from "react";
import { staffGoogleLogin, staffWebAuthnLogin } from "@hotelos/features";
import { Button, TextField, SkipLink } from "@hotelos/ui";
import {
  APP_URLS,
  describeRemoteApiMisconfig,
  login,
  saveSession,
  type StoredUser,
} from "@hotelos/web-client";

const DEMO_TENANT_ID = "11111111-1111-4111-8111-111111111111";

export type LoginPageProps = {
  readonly onLoggedIn: (user: StoredUser) => void;
};

export function LoginPage({ onLoggedIn }: LoginPageProps) {
  const [email, setEmail] = useState("admin@demo.hotelos.local");
  const [password, setPassword] = useState("HotelOS-Demo-ChangeMe1!");
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  function persistLogin(result: Awaited<ReturnType<typeof login>>) {
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
  }

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
      persistLogin(result);
    } catch (submitError) {
      setError(
        describeRemoteApiMisconfig(submitError) ??
          (submitError instanceof Error
            ? submitError.message
            : "שגיאה לא צפויה"),
      );
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setLoading(true);
    setError(undefined);
    try {
      const result = await staffGoogleLogin({
        tenantId: DEMO_TENANT_ID,
        email,
      });
      if (result === "redirecting") return;
      persistLogin(result);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Google login failed",
      );
    } finally {
      setLoading(false);
    }
  }

  async function onWebAuthn() {
    setLoading(true);
    setError(undefined);
    try {
      const result = await staffWebAuthnLogin({
        tenantId: DEMO_TENANT_ID,
        email,
      });
      persistLogin(result);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Biometric login failed",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SkipLink />
      <main id="main-content" className="hotelos-auth-shell" tabIndex={-1}>
        <section className="hero">
          <p className="hotelos-eyebrow">Work · פורטל עובדים</p>
          <h1 className="brand-mark">HotelOS</h1>
          <p className="auth-lede">
            נוכחות, הרשמה ומסמכים — עם סוכן HR שעוזר בלי להעמיס על כוח אדם.
          </p>
          <p className="auth-apps">
            <a href={APP_URLS.ops}>ops</a> · <a href={APP_URLS.hq}>hq</a> ·{" "}
            <a href={APP_URLS.book}>book</a>
          </p>
        </section>
        <section className="auth-panel">
          <form className="auth-form" onSubmit={onSubmit} noValidate>
            <h2>כניסת עובד</h2>
            <TextField
              label="אימייל"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <TextField
              label="סיסמה"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              {...(error !== undefined ? { error } : {})}
            />
            <Button type="submit" disabled={loading}>
              {loading ? "מתחבר…" : "התחברות"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={loading}
              onClick={() => {
                void onGoogle();
              }}
            >
              המשך עם Google
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={loading}
              onClick={() => {
                void onWebAuthn();
              }}
            >
              התחברות באצבע / פנים
            </Button>
            <p className="auth-legal">
              <a href={APP_URLS.legal("terms")}>תנאי שימוש</a>
              {" · "}
              <a href={APP_URLS.legal("privacy")}>פרטיות</a>
            </p>
          </form>
        </section>
      </main>
    </>
  );
}
