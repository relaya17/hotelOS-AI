import { useState, type FormEvent } from "react";
import { Button } from "@hotelos/ui";
import { submitGuestFeedback } from "@hotelos/web-client";

export type FeedbackFormProps = {
  readonly bookingId: string;
  readonly onDone: () => void;
};

const CATEGORY_OPTIONS: readonly { readonly key: string; readonly label: string }[] = [
  { key: "cleanliness", label: "ניקיון" },
  { key: "service", label: "שירות" },
  { key: "pool", label: "בריכה" },
  { key: "food", label: "אוכל" },
  { key: "room", label: "חדר" },
  { key: "location", label: "מיקום" },
];

export function FeedbackForm({ bookingId, onDone }: FeedbackFormProps) {
  const [rating, setRating] = useState(5);
  const [categories, setCategories] = useState<readonly string[]>([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState(false);

  function toggleCategory(key: string) {
    setCategories((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    try {
      await submitGuestFeedback({
        bookingId,
        rating,
        categories,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      });
      setDone(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "שליחת המשוב נכשלה",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="feedback feedback--done">
        <p>תודה על המשוב! נשמח לארח אתכם שוב.</p>
        <Button type="button" variant="ghost" onClick={onDone}>
          סגור
        </Button>
        <style>{`
          .feedback--done { padding:var(--space-4); border:1px solid rgb(15 106 92 / 20%); background:rgb(15 106 92 / 6%); border-radius:var(--radius-sm); display:grid; gap:var(--space-3); }
          .feedback--done p { margin:0; color:var(--color-ink-soft); }
        `}</style>
      </div>
    );
  }

  return (
    <form className="feedback" onSubmit={onSubmit} noValidate>
      <h3>איך הייתה השהייה?</h3>
      <div className="stars" role="radiogroup" aria-label="דירוג">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            className={value <= rating ? "star star--on" : "star"}
            aria-pressed={value <= rating}
            onClick={() => setRating(value)}
          >
            ⭐
          </button>
        ))}
      </div>
      <div className="categories">
        {CATEGORY_OPTIONS.map((option) => (
          <label key={option.key} className="category">
            <input
              type="checkbox"
              checked={categories.includes(option.key)}
              onChange={() => toggleCategory(option.key)}
            />
            {option.label}
          </label>
        ))}
      </div>
      <label className="comment-field">
        <span>הערה (אופציונלי)</span>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={3}
          placeholder="ספרו לנו עוד..."
        />
      </label>
      {error !== undefined ? (
        <p className="state state--error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="feedback__actions">
        <Button type="submit" disabled={submitting}>
          {submitting ? "שולח…" : "שליחת משוב"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          ביטול
        </Button>
      </div>

      <style>{`
        .feedback { padding:var(--space-4); border:1px solid rgb(16 36 31 / 10%); background:var(--color-paper-elevated); border-radius:var(--radius-sm); display:grid; gap:var(--space-3); }
        .feedback h3 { margin:0; font-family:var(--font-display); }
        .stars { display:flex; gap:.3rem; }
        .star { font-size:1.4rem; background:none; border:none; cursor:pointer; opacity:.35; filter:grayscale(1); padding:0; }
        .star--on { opacity:1; filter:none; }
        .categories { display:flex; flex-wrap:wrap; gap:var(--space-2); }
        .category { display:flex; align-items:center; gap:.35rem; font-size:var(--text-small); border:1px solid rgb(16 36 31 / 14%); border-radius:999px; padding:.35rem .7rem; cursor:pointer; }
        .comment-field { display:grid; gap:var(--space-2); }
        .comment-field span { font-size:var(--text-small); font-weight:600; color:var(--color-ink-soft); }
        .comment-field textarea { font:inherit; border:1px solid rgb(16 36 31 / 18%); border-radius:var(--radius-sm); padding:.75rem .85rem; background:#fff; resize:vertical; }
        .feedback__actions { display:flex; gap:var(--space-2); }
        .state { margin:0; color:var(--color-ink-soft); }
        .state--error { color:var(--color-danger); }
      `}</style>
    </form>
  );
}
