import { useEffect, useState } from "react";
import { DashboardPage } from "./dashboard-page.js";
import { LoginPage } from "./login-page.js";
import {
  clearSession,
  readAccessToken,
  readStoredUser,
  type StoredUser,
} from "./session.js";
import { fetchMe } from "./api-client.js";

export function App() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      const token = readAccessToken();
      const stored = readStoredUser();
      if (!token || !stored) {
        if (!cancelled) {
          setBooting(false);
        }
        return;
      }
      try {
        const me = await fetchMe();
        if (!cancelled) {
          setUser({
            id: me.id,
            email: me.email,
            displayName: me.displayName,
            roles: me.roles,
            tenantId: me.scope.tenantId,
            ...(me.scope.hotelId !== undefined
              ? { hotelId: me.scope.hotelId }
              : {}),
          });
        }
      } catch {
        clearSession();
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setBooting(false);
        }
      }
    }
    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  if (booting) {
    return (
      <main className="boot">
        <p>HotelOS AI</p>
        <style>{`
          .boot {
            min-height: 100vh;
            display: grid;
            place-items: center;
            font-family: var(--font-display);
            font-size: var(--text-title);
            color: var(--color-sea-deep);
          }
        `}</style>
      </main>
    );
  }

  if (user) {
    return (
      <DashboardPage
        user={user}
        onLogout={() => {
          setUser(null);
        }}
      />
    );
  }

  return (
    <LoginPage
      onLoggedIn={(nextUser) => {
        setUser(nextUser);
      }}
    />
  );
}
