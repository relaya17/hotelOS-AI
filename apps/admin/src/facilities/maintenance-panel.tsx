import { useEffect, useState, type FormEvent } from "react";
import { Button, TextField } from "@hotelos/ui";
import {
  createMaintenanceRequest,
  createVendor,
  createVendorQuote,
  decideQuote,
  listMaintenanceRequests,
  listQuotesForRequest,
  listVendors,
  suggestAutonomyDepartmentTask,
  suggestAutonomyMaintenanceQuoteAccept,
  updateMaintenanceRequestStatus,
  type MaintenanceCategory,
  type MaintenanceRequestDto,
  type MaintenanceStatus,
  type TaskPriority,
  type VendorCategory,
  type VendorDto,
  type VendorQuoteDto,
} from "@hotelos/web-client";

export type MaintenancePanelProps = {
  readonly hotelId: string;
};

const categoryLabel: Record<MaintenanceCategory, string> = {
  repair: "תיקון",
  renovation: "שיפוץ",
  pool: "בריכה",
  linen: "מגבות/מצעים",
  general: "כללי",
};

const priorityLabel: Record<TaskPriority, string> = {
  low: "נמוכה",
  medium: "בינונית",
  high: "גבוהה",
  urgent: "דחוף",
};

const statusLabel: Record<MaintenanceStatus, string> = {
  open: "פתוחה",
  quote_requested: "ממתין להצעת מחיר",
  approved: "אושרה",
  in_progress: "בביצוע",
  done: "הושלמה",
  cancelled: "בוטלה",
};

const nextStatusOptions: Record<MaintenanceStatus, readonly MaintenanceStatus[]> = {
  open: ["in_progress", "cancelled"],
  quote_requested: ["approved", "cancelled"],
  approved: ["in_progress", "cancelled"],
  in_progress: ["done", "cancelled"],
  done: [],
  cancelled: [],
};

const vendorCategoryLabel: Record<VendorCategory, string> = {
  contractor: "קבלן",
  supplier: "ספק",
  both: "קבלן + ספק",
};

export function MaintenancePanel({ hotelId }: MaintenancePanelProps) {
  const [requests, setRequests] = useState<readonly MaintenanceRequestDto[]>([]);
  const [vendors, setVendors] = useState<readonly VendorDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [suggestingQuoteId, setSuggestingQuoteId] = useState<string | undefined>();
  const [suggestingRequestId, setSuggestingRequestId] = useState<
    string | undefined
  >();
  const [suggestingUrgentBatch, setSuggestingUrgentBatch] = useState(false);

  const [category, setCategory] = useState<MaintenanceCategory>("repair");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | undefined>();

  const [vendorName, setVendorName] = useState("");
  const [vendorCategory, setVendorCategory] = useState<VendorCategory>("contractor");
  const [vendorPhone, setVendorPhone] = useState("");
  const [addingVendor, setAddingVendor] = useState(false);

  const [selectedRequestId, setSelectedRequestId] = useState<string | undefined>();
  const [quotes, setQuotes] = useState<readonly VendorQuoteDto[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quoteVendorId, setQuoteVendorId] = useState("");
  const [quoteAmount, setQuoteAmount] = useState("");
  const [addingQuote, setAddingQuote] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(undefined);
      try {
        const [requestData, vendorData] = await Promise.all([
          listMaintenanceRequests(hotelId),
          listVendors(),
        ]);
        if (cancelled) return;
        setRequests(requestData);
        setVendors(vendorData);
        setQuoteVendorId((prev) => prev || vendorData[0]?.id || "");
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "שגיאה בטעינה",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  useEffect(() => {
    if (!selectedRequestId) {
      setQuotes([]);
      return;
    }
    const requestId = selectedRequestId;
    let cancelled = false;
    async function loadQuotes() {
      setQuotesLoading(true);
      try {
        const data = await listQuotesForRequest(requestId);
        if (!cancelled) setQuotes(data);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "שגיאה בטעינה",
          );
        }
      } finally {
        if (!cancelled) setQuotesLoading(false);
      }
    }
    void loadQuotes();
    return () => {
      cancelled = true;
    };
  }, [selectedRequestId]);

  async function onCreateRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setCreateError(undefined);
    try {
      const created = await createMaintenanceRequest(hotelId, {
        category,
        title,
        description,
        priority,
      });
      setRequests((prev) => [created, ...prev]);
      setTitle("");
      setDescription("");
      setPriority("medium");
    } catch (submitError) {
      setCreateError(
        submitError instanceof Error ? submitError.message : "יצירה נכשלה",
      );
    } finally {
      setCreating(false);
    }
  }

  async function onAddVendor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vendorName.trim()) return;
    setAddingVendor(true);
    try {
      const created = await createVendor({
        name: vendorName,
        category: vendorCategory,
        ...(vendorPhone ? { phone: vendorPhone } : {}),
      });
      setVendors((prev) => [...prev, created]);
      setVendorName("");
      setVendorPhone("");
      setQuoteVendorId((prev) => prev || created.id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "הוספת ספק נכשלה");
    } finally {
      setAddingVendor(false);
    }
  }

  async function onChangeStatus(requestId: string, status: MaintenanceStatus) {
    try {
      const updated = await updateMaintenanceRequestStatus(requestId, status);
      setRequests((prev) =>
        prev.map((request) => (request.id === updated.id ? updated : request)),
      );
    } catch {
      setError("עדכון הסטטוס נכשל, נסו שוב");
    }
  }

  async function onAddQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRequestId || !quoteVendorId) return;
    const amount = Number.parseInt(quoteAmount, 10);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setAddingQuote(true);
    try {
      const created = await createVendorQuote(selectedRequestId, {
        vendorId: quoteVendorId,
        amount,
      });
      setQuotes((prev) => [created, ...prev]);
      setQuoteAmount("");
      setRequests((prev) =>
        prev.map((request) =>
          request.id === selectedRequestId
            ? { ...request, status: "quote_requested" }
            : request,
        ),
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "בקשת ההצעה נכשלה",
      );
    } finally {
      setAddingQuote(false);
    }
  }

  async function onDecideQuote(quoteId: string, status: "accepted" | "rejected") {
    try {
      const updated = await decideQuote(quoteId, status);
      setQuotes((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
      if (status === "accepted" && selectedRequestId) {
        const list = await listMaintenanceRequests(hotelId);
        setRequests(list);
      }
    } catch {
      setError("עדכון ההצעה נכשל, נסו שוב");
    }
  }

  async function onSuggestQuoteAccept(quote: VendorQuoteDto) {
    if (!selectedRequestId) return;
    const request = requests.find((r) => r.id === selectedRequestId);
    setSuggestingQuoteId(quote.id);
    setError(undefined);
    try {
      const result = await suggestAutonomyMaintenanceQuoteAccept({
        hotelId,
        maintenanceRequestId: selectedRequestId,
        quoteId: quote.id,
        ...(request?.title ? { requestTitle: request.title } : {}),
      });
      setNotice(
        `Suggest נשלח לאישורי AI (₪${result.amount ?? quote.amount}). אשרו בתיבת האישורים → Act יקבל את ההצעה.`,
      );
    } catch (suggestError) {
      setError(
        suggestError instanceof Error
          ? suggestError.message
          : "שליחת הצעת אישור AI נכשלה",
      );
    } finally {
      setSuggestingQuoteId(undefined);
    }
  }

  const urgentOpen = requests.filter(
    (r) =>
      (r.status === "open" || r.status === "in_progress") &&
      (r.priority === "urgent" || r.priority === "high"),
  );

  async function onSuggestRequestFollowup(request: MaintenanceRequestDto) {
    setSuggestingRequestId(request.id);
    setError(undefined);
    try {
      const result = await suggestAutonomyDepartmentTask({
        hotelId,
        departmentCode: "maintenance",
        taskType: "maintenance_followup",
        title: `מעקב תחזוקה — ${request.title}`.slice(0, 160),
        description: [
          "מעקב קריאת תחזוקה אחרי Suggest→Approve→Act.",
          `עדיפות: ${request.priority}`,
          `סטטוס: ${request.status}`,
          `קטגוריה: ${request.category}`,
          request.description,
          `מזהה קריאה: ${request.id}`,
          "אין שיבוץ קבלן / תשלום אוטומטי.",
        ].join("\n"),
        priority: request.priority === "urgent" ? "urgent" : "high",
        agentId: "agent.maintenance",
        summaryHe: `מעקב תחזוקה: ${request.title}`.slice(0, 240),
        reasonHe:
          "קריאה דחופה/גבוהה — נדרש אישור מפקח לפני פתיחת משימת מעקב במחלקה.",
      });
      setNotice(
        `Suggest מעקב תחזוקה נשלח (${result.approvalId.slice(0, 8)}…). אשרו → Act ייפתח משימה.`,
      );
    } catch (suggestError) {
      setError(
        suggestError instanceof Error
          ? suggestError.message
          : "הצעת מעקב תחזוקה נכשלה",
      );
    } finally {
      setSuggestingRequestId(undefined);
    }
  }

  async function onSuggestUrgentBatch() {
    if (urgentOpen.length === 0) return;
    setSuggestingUrgentBatch(true);
    setError(undefined);
    try {
      let count = 0;
      for (const request of urgentOpen.slice(0, 12)) {
        await suggestAutonomyDepartmentTask({
          hotelId,
          departmentCode: "maintenance",
          taskType: "maintenance_followup",
          title: `מעקב תחזוקה — ${request.title}`.slice(0, 160),
          description: [
            "מעקב קריאת תחזוקה (אצווה דחופה) אחרי Suggest→Approve→Act.",
            `עדיפות: ${request.priority}`,
            `סטטוס: ${request.status}`,
            request.description,
            `מזהה קריאה: ${request.id}`,
            "אין שיבוץ קבלן / תשלום אוטומטי.",
          ].join("\n"),
          priority: request.priority === "urgent" ? "urgent" : "high",
          agentId: "agent.maintenance",
          summaryHe: `מעקב תחזוקה: ${request.title}`.slice(0, 240),
          reasonHe:
            "אצוות קריאות דחופות — נדרש אישור מפקח לפני פתיחת משימות מעקב.",
        });
        count += 1;
      }
      setNotice(
        `נשלחו ${count} Suggest לאישורי AI לקריאות דחופות/גבוהות. אשרו → Act ייפתח משימות.`,
      );
    } catch (suggestError) {
      setError(
        suggestError instanceof Error
          ? suggestError.message
          : "הצעת אצווה דחופה נכשלה",
      );
    } finally {
      setSuggestingUrgentBatch(false);
    }
  }

  return (
    <div className="panel">
      {loading ? <p className="state">טוען…</p> : null}
      {error !== undefined ? (
        <p className="state state--error" role="alert">
          {error}
        </p>
      ) : null}
      {notice !== undefined ? (
        <p className="state state--ok" role="status">
          {notice}
        </p>
      ) : null}

      <section className="card">
        <h2>קריאות תחזוקה, תיקונים ושיפוצים</h2>
        {urgentOpen.length > 0 ? (
          <div className="suggest-box">
            <p>
              Suggest→Approve→Act: {urgentOpen.length} קריאות דחופות/גבוהות
              פתוחות — שליחה לתיבת אישורי AI כמשימות מעקב (ללא שיבוץ קבלן).
            </p>
            <Button
              type="button"
              disabled={suggestingUrgentBatch}
              onClick={() => void onSuggestUrgentBatch()}
            >
              {suggestingUrgentBatch
                ? "שולח…"
                : `הצע מעקב לכל הדחופות (${Math.min(urgentOpen.length, 12)})`}
            </Button>
          </div>
        ) : null}
        <ul className="list">
          {requests.map((request) => (
            <li key={request.id} className="row row--task">
              <div>
                <h3>{request.title}</h3>
                <p>{request.description}</p>
                <p className="meta">
                  {categoryLabel[request.category]} · עדיפות{" "}
                  {priorityLabel[request.priority]}
                  {request.estimatedCost !== null
                    ? ` · הצעה מאושרת: ${request.estimatedCost}`
                    : ""}
                </p>
              </div>
              <div className="row__actions">
                <span className={`status status--maint-${request.status}`}>
                  {statusLabel[request.status]}
                </span>
                {(request.priority === "urgent" ||
                  request.priority === "high") &&
                (request.status === "open" ||
                  request.status === "in_progress") ? (
                  <button
                    type="button"
                    className="mini-btn"
                    disabled={suggestingRequestId === request.id}
                    onClick={() => void onSuggestRequestFollowup(request)}
                  >
                    {suggestingRequestId === request.id
                      ? "שולח…"
                      : "הצע מעקב (Suggest)"}
                  </button>
                ) : null}
                {nextStatusOptions[request.status].map((next) => (
                  <button
                    key={next}
                    type="button"
                    className="mini-btn"
                    onClick={() => void onChangeStatus(request.id, next)}
                  >
                    {statusLabel[next]}
                  </button>
                ))}
                <button
                  type="button"
                  className="mini-btn mini-btn--accent"
                  onClick={() =>
                    setSelectedRequestId(
                      selectedRequestId === request.id ? undefined : request.id,
                    )
                  }
                >
                  {selectedRequestId === request.id ? "סגור הצעות" : "הצעות מחיר"}
                </button>
              </div>
            </li>
          ))}
        </ul>

        <form className="create-form" onSubmit={onCreateRequest} noValidate>
          <h3>קריאה חדשה</h3>
          <label className="select-field">
            <span>קטגוריה</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MaintenanceCategory)}
            >
              {(Object.keys(categoryLabel) as MaintenanceCategory[]).map((key) => (
                <option key={key} value={key}>
                  {categoryLabel[key]}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="כותרת"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <label className="select-field">
            <span>תיאור</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
            />
          </label>
          <label className="select-field">
            <span>עדיפות</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
            >
              {(Object.keys(priorityLabel) as TaskPriority[]).map((key) => (
                <option key={key} value={key}>
                  {priorityLabel[key]}
                </option>
              ))}
            </select>
          </label>
          {createError !== undefined ? (
            <p className="state state--error" role="alert">
              {createError}
            </p>
          ) : null}
          <Button type="submit" disabled={creating}>
            {creating ? "יוצר…" : "צור קריאה"}
          </Button>
        </form>
      </section>

      {selectedRequestId ? (
        <section className="card">
          <h2>הצעות מחיר</h2>
          {quotesLoading ? <p className="state">טוען הצעות…</p> : null}
          {!quotesLoading && quotes.length === 0 ? (
            <p className="hint">אין הצעות מחיר עדיין עבור קריאה זו.</p>
          ) : null}
          <ul className="list">
            {quotes.map((quote) => {
              const vendor = vendors.find((v) => v.id === quote.vendorId);
              return (
                <li key={quote.id} className="row">
                  <div>
                    <h3>{vendor?.name ?? "ספק"}</h3>
                    <p>
                      {quote.amount} {quote.currency}
                    </p>
                  </div>
                  <div className="row__actions">
                    <span className={`status status--quote-${quote.status}`}>
                      {quote.status === "pending"
                        ? "ממתין"
                        : quote.status === "accepted"
                          ? "אושרה"
                          : quote.status === "rejected"
                            ? "נדחתה"
                            : "פגה"}
                    </span>
                    {quote.status === "pending" ? (
                      <>
                        <button
                          type="button"
                          className="mini-btn"
                          disabled={suggestingQuoteId === quote.id}
                          onClick={() => void onSuggestQuoteAccept(quote)}
                        >
                          {suggestingQuoteId === quote.id
                            ? "שולח…"
                            : "הצע אישור AI"}
                        </button>
                        <button
                          type="button"
                          className="mini-btn"
                          onClick={() => void onDecideQuote(quote.id, "accepted")}
                        >
                          אשר ישירות
                        </button>
                        <button
                          type="button"
                          className="mini-btn"
                          onClick={() => void onDecideQuote(quote.id, "rejected")}
                        >
                          דחה
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>

          <form className="create-form" onSubmit={onAddQuote} noValidate>
            <h3>הצעת מחיר חדשה</h3>
            <label className="select-field">
              <span>ספק / קבלן</span>
              <select
                value={quoteVendorId}
                onChange={(e) => setQuoteVendorId(e.target.value)}
                required
              >
                <option value="" disabled>
                  בחרו ספק
                </option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </label>
            <TextField
              label="סכום ההצעה (₪)"
              name="amount"
              type="number"
              min={1}
              value={quoteAmount}
              onChange={(e) => setQuoteAmount(e.target.value)}
              required
            />
            <Button type="submit" disabled={addingQuote || !quoteVendorId}>
              {addingQuote ? "שולח…" : "הוסף הצעה"}
            </Button>
          </form>
        </section>
      ) : null}

      <section className="card">
        <h2>ספקים וקבלנים</h2>
        <ul className="list">
          {vendors.map((vendor) => (
            <li key={vendor.id} className="row">
              <div>
                <h3>{vendor.name}</h3>
                <p>
                  {vendorCategoryLabel[vendor.category]}
                  {vendor.phone ? ` · ${vendor.phone}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <form className="create-form" onSubmit={onAddVendor} noValidate>
          <h3>ספק / קבלן חדש</h3>
          <TextField
            label="שם"
            name="vendorName"
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            required
          />
          <label className="select-field">
            <span>סוג</span>
            <select
              value={vendorCategory}
              onChange={(e) => setVendorCategory(e.target.value as VendorCategory)}
            >
              {(Object.keys(vendorCategoryLabel) as VendorCategory[]).map((key) => (
                <option key={key} value={key}>
                  {vendorCategoryLabel[key]}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="טלפון"
            name="vendorPhone"
            value={vendorPhone}
            onChange={(e) => setVendorPhone(e.target.value)}
          />
          <Button type="submit" disabled={addingVendor}>
            {addingVendor ? "מוסיף…" : "הוסף ספק"}
          </Button>
        </form>
      </section>

      <style>{`
        .panel { display:grid; gap:var(--space-4); }
        .card { background:rgb(255 250 242 / 90%); border:1px solid rgb(16 36 31 / 10%); border-radius:calc(var(--radius-md) + .1rem); box-shadow:var(--shadow-soft); padding:clamp(1.2rem,2.5vw,1.8rem); display:grid; gap:var(--space-4); }
        .card h2 { margin:0; font-size:var(--text-title); }
        .hint { margin:0; color:var(--color-ink-soft); }
        .list { list-style:none; margin:0; padding:0; display:grid; gap:var(--space-3); }
        .row { display:flex; justify-content:space-between; gap:var(--space-3); align-items:center; padding:var(--space-4); border:1px solid rgb(16 36 31 / 10%); border-radius:var(--radius-sm); background:var(--color-paper-elevated); }
        .row--task { align-items:flex-start; }
        .row h3 { margin:0; font-family:var(--font-display); font-size:1.1rem; }
        .row p { margin:var(--space-1) 0 0; color:var(--color-ink-soft); font-size:var(--text-small); }
        .row .meta { color:var(--color-ink-soft); }
        .row__actions { display:flex; flex-direction:column; gap:var(--space-2); align-items:flex-end; }
        .status { font-size:var(--text-small); font-weight:700; padding:.35rem .7rem; border-radius:999px; white-space:nowrap; }
        .status--maint-open { color:#1f4b7a; background:rgb(31 75 122 / 12%); }
        .status--maint-quote_requested { color:#8a5a12; background:rgb(138 90 18 / 12%); }
        .status--maint-approved { color:#0f6a5c; background:rgb(15 106 92 / 12%); }
        .status--maint-in_progress { color:#8a5a12; background:rgb(138 90 18 / 12%); }
        .status--maint-done { color:#0f6a5c; background:rgb(15 106 92 / 12%); }
        .status--maint-cancelled { color:#445; background:rgb(68 68 85 / 10%); }
        .status--quote-pending { color:#8a5a12; background:rgb(138 90 18 / 12%); }
        .status--quote-accepted { color:#0f6a5c; background:rgb(15 106 92 / 12%); }
        .status--quote-rejected { color:#9b2c2c; background:rgb(155 44 44 / 12%); }
        .status--quote-expired { color:#445; background:rgb(68 68 85 / 10%); }
        .mini-btn { font:inherit; font-size:var(--text-small); border:1px solid rgb(16 36 31 / 18%); background:transparent; border-radius:var(--radius-sm); padding:.3rem .6rem; cursor:pointer; font-weight:600; }
        .mini-btn--accent { border-color:var(--color-sea-deep); color:var(--color-sea-deep); }
        .suggest-box { display:grid; gap:var(--space-3); border:1px dashed rgb(16 36 31 / 22%); border-radius:var(--radius-sm); padding:var(--space-4); }
        .suggest-box p { margin:0; color:var(--color-ink-soft); font-size:var(--text-small); }
        .create-form { display:grid; gap:var(--space-3); border-top:1px solid rgb(16 36 31 / 10%); padding-top:var(--space-4); }
        .create-form h3 { margin:0; font-family:var(--font-display); }
        .select-field { display:grid; gap:var(--space-2); }
        .select-field span { font-size:var(--text-small); font-weight:600; color:var(--color-ink-soft); }
        .select-field select, .select-field textarea { font:inherit; border:1px solid rgb(16 36 31 / 18%); border-radius:var(--radius-sm); padding:.85rem .95rem; background:var(--color-paper-elevated); resize:vertical; }
        .state { margin:0; color:var(--color-ink-soft); }
        .state--error { color:var(--color-danger); }
        .state--ok { color:#0f6a5c; background:rgb(15 106 92 / 10%); padding:.75rem 1rem; border-radius:var(--radius-sm); }
      `}</style>
    </div>
  );
}
