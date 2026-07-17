import { useEffect, useState } from "react";
import {
  clearSession,
  fetchMe,
  readAccessToken,
  readStoredUser,
  type StoredUser,
} from "@hotelos/web-client";
import { ExecutiveShell } from "./executive-shell.js";
import { LoginPage } from "./login-page.js";

export function App() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      const token = readAccessToken();
      const stored = readStoredUser();
      if (!token || !stored) {
        if (!cancelled) setBooting(false);
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
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setBooting(false);
      }
    }
    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  if (booting) {
    return <main className="boot">HotelOS AI · Executive</main>;
  }

  if (user) {
    return (
      <ExecutiveShell
        user={user}
        onLogout={() => {
          setUser(null);
        }}
      />
    );
  }

  return (
    <LoginPage
      onLoggedIn={(next) => {
        setUser(next);
      }}
    />
  );
}
