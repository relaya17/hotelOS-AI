import { useState, type FormEvent } from "react";
import { staffGoogleLogin, staffWebAuthnLogin } from "@hotelos/features";
import { Button, CookieBanner, TextField } from "@hotelos/ui";
import {
  APP_URLS,
  login,
  getConsentSubjectKey,
  saveCookieConsent,
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
        submitError instanceof Error ? submitError.message : "שגיאה לא צפויה",
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
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Executive · רשת</p>
        <h1>HotelOS AI</h1>
        <p className="lede">
          לוח בקרה ברמת הרשת — כל בתי המלון, תפוסה והזמנות פעילות במבט אחד.
        </p>
        <p className="apps">
          אפליקציות נפרדות:{" "}
          <a href={APP_URLS.admin}>תפעול מלון</a> ·{" "}
          <a href={APP_URLS.guest}>אורחים</a>
        </p>
      </section>
      <section className="panel">
        <form className="form" onSubmit={onSubmit} noValidate>
          <h2>כניסת הנהלת רשת</h2>
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
            המשך עם Google (צוות)
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
          <p className="legal">
            <a href={APP_URLS.legal("terms")}>תנאי שימוש</a>
            {" · "}
            <a href={APP_URLS.legal("cookies")}>עוגיות</a>
            {" · "}
            <a href={APP_URLS.legal("security")}>אבטחה</a>
            {" · "}
            <a href={APP_URLS.legal("privacy")}>פרטיות</a>
          </p>
        </form>
      </section>
      <CookieBanner
        legalCookiesUrl={APP_URLS.legal("cookies")}
        onConsent={(consent) => {
          void saveCookieConsent({
            subjectKey: getConsentSubjectKey("anon"),
            necessary: consent.necessary,
            functional: consent.functional,
            tenantId: DEMO_TENANT_ID,
          });
        }}
      />
      <style>{`
        .shell { min-height:100vh; display:grid; grid-template-columns:1.1fr .9fr; gap:var(--space-6); padding:clamp(1.5rem,4vw,4rem); align-items:center; }
        .eyebrow { margin:0 0 var(--space-3); letter-spacing:.08em; text-transform:uppercase; font-size:var(--text-small); color:var(--color-sea-deep); font-weight:700; }
        h1 { font-size:var(--text-display); margin:0; max-width:10ch; }
        .lede { margin:var(--space-4) 0 0; max-width:36ch; color:var(--color-ink-soft); font-size:1.15rem; }
        .apps { margin-top:var(--space-4); font-size:var(--text-small); }
        .panel { background:rgb(255 250 242 / 88%); border:1px solid rgb(16 36 31 / 10%); border-radius:calc(var(--radius-md) + .15rem); box-shadow:var(--shadow-soft); padding:clamp(1.4rem,3vw,2.2rem); }
        .form { display:grid; gap:var(--space-4); }
        .form h2 { margin:0; font-size:var(--text-title); }
        .legal{margin:0;font-size:var(--text-small);color:var(--color-ink-soft)}
        @media (max-width:900px){ .shell{ grid-template-columns:1fr; } }
      `}</style>
    </main>
  );
}
