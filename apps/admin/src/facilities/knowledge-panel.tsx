import { useEffect, useState, type FormEvent } from "react";
import { Button, TextField } from "@hotelos/ui";
import {
  approveCompanyKnowledgeDoc,
  createCompanyKnowledgeDoc,
  listCompanyKnowledgeDocs,
  searchCompanyKnowledgeDocs,
  type CompanyKnowledgeDocDto,
} from "@hotelos/web-client";

export function KnowledgePanel() {
  const [docs, setDocs] = useState<readonly CompanyKnowledgeDocDto[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<readonly CompanyKnowledgeDocDto[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true);
    setError(undefined);
    try {
      setDocs(await listCompanyKnowledgeDocs());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "שגיאה");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await createCompanyKnowledgeDoc({
        title,
        body,
        category: "sop",
      });
      setTitle("");
      setBody("");
      await reload();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "שגיאה");
    }
  }

  async function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    try {
      setHits(await searchCompanyKnowledgeDocs(query));
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "שגיאה");
    }
  }

  if (loading) return <p>טוען ידע ארגוני…</p>;

  return (
    <section>
      <h2>Company Knowledge</h2>
      <p className="muted">
        מסמכים פנימיים לאישור לפני שימוש כציטוט ע״י סוכנים (מילות מפתח +
        embeddings באישור → Gateway).
      </p>
      {error ? <p className="error">{error}</p> : null}

      <form className="stack" onSubmit={(e) => void onSearch(e)}>
        <TextField
          label="חיפוש במאושרים"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          required
        />
        <Button type="submit">חפש</Button>
      </form>
      {hits.length > 0 ? (
        <ul className="docs">
          {hits.map((doc) => (
            <li key={`hit-${doc.id}`}>
              <strong>{doc.title}</strong> · מאושר
              <pre>{doc.body}</pre>
            </li>
          ))}
        </ul>
      ) : null}

      <form className="stack" onSubmit={(e) => void onCreate(e)}>
        <TextField
          label="כותרת"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <label>
          תוכן
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            required
          />
        </label>
        <Button type="submit">שלח לאישור</Button>
      </form>

      <ul className="docs">
        {docs.map((doc) => (
          <li key={doc.id}>
            <strong>{doc.title}</strong> · {doc.status}
            <pre>{doc.body}</pre>
            {doc.status === "pending_approval" ? (
              <Button
                type="button"
                onClick={() =>
                  void approveCompanyKnowledgeDoc(doc.id)
                    .then(reload)
                    .catch((approveError: unknown) => {
                      setError(
                        approveError instanceof Error
                          ? approveError.message
                          : "אישור נכשל",
                      );
                    })
                }
              >
                אשר מסמך
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

      <style>{`
        .stack{display:grid;gap:.75rem;max-width:36rem}
        .stack textarea{width:100%;font:inherit;padding:.75rem;border-radius:8px;border:1px solid rgb(16 36 31 / 18%)}
        .docs{list-style:none;padding:0;display:grid;gap:1rem}
        .docs pre{white-space:pre-wrap;font:inherit;background:rgb(255 250 242);padding:.75rem;border-radius:8px}
        .muted{opacity:.75}
        .error{color:#8b1e1e}
      `}</style>
    </section>
  );
}
