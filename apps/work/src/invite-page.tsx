import { useEffect, useState, type FormEvent } from "react";
import { Button, TextField } from "@hotelos/ui";
import {
  completePublicHrInvite,
  fetchPublicHrInvite,
  type PublicHrInviteDto,
} from "@hotelos/web-client";

export type InvitePageProps = {
  readonly token: string;
  readonly onDone: () => void;
};

export function InvitePage({ token, onDone }: InvitePageProps) {
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
        <p className="hotelos-eyebrow">HotelOS · Work</p>
        <h1>נרשמת בהצלחה</h1>
        <p>
          קוד העובד שלך: <strong>{doneCode}</strong>
        </p>
        <p>התחברו עם האימייל והסיסמה שהגדרתם — לנוכחות ולסוכן HR.</p>
        <Button type="button" onClick={onDone}>
          מעבר להתחברות
        </Button>
        <style>{inviteStyles}</style>
      </main>
    );
  }

  return (
    <main id="main-content" className="invite" tabIndex={-1}>
      <p className="hotelos-eyebrow">HotelOS · הרשמת עובד</p>
      <h1>השלמת הרשמה עצמית</h1>
      {invite ? (
        <p className="invite__meta">
          תפקיד: {invite.roleHint} · {invite.email}
        </p>
      ) : null}
      {error ? <p className="invite__error">{error}</p> : null}
      {invite ? (
        <form className="invite__form" onSubmit={(e) => void onSubmit(e)}>
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
      <style>{inviteStyles}</style>
    </main>
  );
}

const inviteStyles = `
  .invite {
    max-width: 28rem;
    margin: 0 auto;
    padding: clamp(1.5rem, 4vw, 3rem);
    display: grid;
    gap: var(--space-4);
    animation: hotelos-enter var(--motion-med) var(--ease-out) both;
  }
  .invite h1 { font-size: clamp(1.5rem, 3vw, 1.9rem); color: var(--color-sea-deep); }
  .invite__meta, .invite p { color: var(--color-ink-soft); font-weight: 500; line-height: 1.6; }
  .invite__form { display: grid; gap: var(--space-3); }
  .invite__error { color: var(--color-danger); font-weight: 600; }
`;
