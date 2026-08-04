import { useEffect, useState, type FormEvent } from "react";
import { Button, TextField } from "@hotelos/ui";
import {
  approveCompanyKnowledgeDoc,
  createCompanyKnowledgeDoc,
  listCompanyKnowledgeChunks,
  listCompanyKnowledgeDocs,
  reindexCompanyKnowledgeDoc,
  searchCompanyKnowledgeDocs,
  type CompanyKnowledgeChunkDto,
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
  const [openCitations, setOpenCitations] = useState<string | undefined>();
  const [chunksByDoc, setChunksByDoc] = useState<
    Readonly<Record<string, readonly CompanyKnowledgeChunkDto[]>>
  >({});

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

  async function toggleCitations(docId: string) {
    if (openCitations === docId) {
      setOpenCitations(undefined);
      return;
    }
    setOpenCitations(docId);
    if (chunksByDoc[docId]) return;
    try {
      const chunks = await listCompanyKnowledgeChunks(docId);
      setChunksByDoc((prev) => ({ ...prev, [docId]: chunks }));
    } catch (chunksError) {
      setError(
        chunksError instanceof Error ? chunksError.message : "טעינת chunks נכשלה",
      );
    }
  }

  if (loading) return <p>טוען ידע ארגוני…</p>;

  return (
    <section>
      <h2>Company Knowledge</h2>
      <p className="muted">
        מסמכים פנימיים לאישור לפני שימוש כציטוט ע״י סוכנים (מילות מפתח +
        embeddings + chunks באישור → Gateway). מסמכים ישנים יקבלו chunks
        אוטומטית בשימוש / cron, או ידנית ב״רענון אינדקס״.
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
            {doc.status === "approved" ? (
              <div className="actions">
                <Button type="button" onClick={() => void toggleCitations(doc.id)}>
                  {openCitations === doc.id ? "הסתר ציטוטים" : "הצג ציטוטים"}
                </Button>
                <Button
                  type="button"
                  onClick={() =>
                    void reindexCompanyKnowledgeDoc(doc.id)
                      .then((result) => {
                        setError(undefined);
                        setChunksByDoc((prev) => {
                          const next = { ...prev };
                          delete next[doc.id];
                          return next;
                        });
                        window.alert(
                          `רענון הושלם: ${result.chunkCount} chunks` +
                            (result.embedded ? ", embedding מסמך" : "") +
                            (result.chunksEmbedded > 0
                              ? `, ${result.chunksEmbedded} chunk embeddings`
                              : ""),
                        );
                        return reload();
                      })
                      .catch((reindexError: unknown) => {
                        setError(
                          reindexError instanceof Error
                            ? reindexError.message
                            : "רענון נכשל",
                        );
                      })
                  }
                >
                  רענון אינדקס
                </Button>
              </div>
            ) : null}
            {doc.status === "approved" && openCitations === doc.id ? (
              <CitationList
                citations={chunksByDoc[doc.id]}
                docTitle={doc.title}
              />
            ) : null}
          </li>
        ))}
      </ul>

      <style>{`
        .stack{display:grid;gap:.75rem;max-width:36rem}
        .stack textarea{width:100%;font:inherit;padding:.75rem;border-radius:8px;border:1px solid var(--color-line-strong)}
        .docs{list-style:none;padding:0;display:grid;gap:1rem}
        .docs pre{white-space:pre-wrap;font:inherit;background:var(--color-paper);padding:.75rem;border-radius:8px}
        .actions{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.5rem}
        .cites{list-style:none;padding:0;margin:.75rem 0 0;display:grid;gap:.5rem}
        .cite{border:1px solid var(--color-line-strong);border-radius:8px;padding:.75rem;background:var(--color-paper)}
        .cite__meta{display:flex;flex-wrap:wrap;gap:.5rem;font-size:.85rem;opacity:.8;margin-bottom:.35rem}
        .cite__chip{display:inline-block;padding:.1rem .4rem;border-radius:4px;background:var(--color-line-strong)}
        .muted{opacity:.75}
        .error{color:#8b1e1e}
      `}</style>
    </section>
  );
}

function CitationList({
  citations,
  docTitle,
}: {
  readonly citations: readonly CompanyKnowledgeChunkDto[] | undefined;
  readonly docTitle: string;
}) {
  if (!citations) return <p className="muted">טוען ציטוטים…</p>;
  if (citations.length === 0) {
    return (
      <p className="muted">
        אין chunks עדיין — לחצו «רענון אינדקס» או המתינו ל־cron.
      </p>
    );
  }
  return (
    <ul className="cites" aria-label={`ציטוטים · ${docTitle}`}>
      {citations.map((chunk) => (
        <li key={chunk.id} className="cite">
          <div className="cite__meta">
            <span className="cite__chip">ארגון</span>
            <span>
              {docTitle} · קטע {chunk.chunkIndex + 1}
            </span>
            <span>
              {chunk.hasEmbedding ? "embedding ✓" : "ללא embedding"}
            </span>
          </div>
          <pre>{chunk.text}</pre>
        </li>
      ))}
    </ul>
  );
}
