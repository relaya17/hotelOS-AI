import { useEffect, useState, type FormEvent } from "react";
import { Button, TextField } from "@hotelos/ui";
import {
  completePublicHrInvite,
  fetchPublicHrInvite,
  type PublicHrInviteDto,
} from "@hotelos/web-client";

export type InvitePageProps = {
  readonly token: string;
};

export function InvitePage({ token }: InvitePageProps) {
  const [invite, setInvite] = useState<PublicHrInviteDto | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [doneCode, setDoneCode] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchPublicHrInvite(token);
        if (!cancelled) {
          setInvite(data);
          setDisplayName(data.displayNameHint);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "הזמנה לא זמינה",
          );
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    try {
      const result = await completePublicHrInvite(token, {
        displayName,
        password,
        preferredLocale: "he",
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(nationalId.trim() ? { nationalId: nationalId.trim() } : {}),
        ...(address.trim() ? { address: address.trim() } : {}),
      });
      setDoneCode(result.employeeCode);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "הרשמה נכשלה",
      );
    }
  }

  if (doneCode !== null) {
    return (
      <main id="main-content" className="invite" tabIndex={-1}>
        <h1>נרשמת בהצלחה</h1>
        <p>
          קוד העובד שלך: <strong>{doneCode ?? "—"}</strong>
        </p>
        <p>אפשר לסגור את החלון ולהתחבר עם האימייל והסיסמה שהגדרת.</p>
      </main>
    );
  }

  return (
    <main id="main-content" className="invite" tabIndex={-1}>
      <p className="eyebrow">HotelOS AI · הרשמת עובד</p>
      <h1>השלמת הרשמה עצמית</h1>
      {invite ? (
        <p>
          תפקיד: {invite.roleHint} · {invite.email}
        </p>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {invite ? (
        <form className="stack" onSubmit={(e) => void onSubmit(e)}>
          <TextField
            label="שם מלא"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <TextField
            label="טלפון"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <TextField
            label="ת.ז"
            value={nationalId}
            onChange={(e) => setNationalId(e.target.value)}
          />
          <TextField
            label="כתובת"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <TextField
            label="סיסמה"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit">סיום הרשמה</Button>
        </form>
      ) : null}
      <style>{`
        .invite{max-width:28rem;margin:2rem auto;padding:1rem}
        .invite .stack{display:grid;gap:.75rem}
        .invite .error{color:#8b1e1e}
        .eyebrow{opacity:.7;font-size:.85rem}
      `}</style>
    </main>
  );
}
