import { useEffect, useState } from "react";
import { Button, CitationList, TextField } from "@hotelos/ui";
import {
  createTrustedSource,
  decideRevenueSuggestion,
  decideEnergySuggestion,
  fetchAiGatewayStatus,
  fetchCioDigest,
  fetchEnergySuggestions,
  fetchOpsAnomalies,
  fetchOpsForecast,
  fetchRevenueSuggestions,
  generateEnergySuggestions,
  generateRevenueSuggestions,
  invokeAiGateway,
  listOrgCommsChannels,
  listOrgCommsMessages,
  listTrustedSources,
  postOrgCommsMessage,
  suggestAutonomyBriefingAction,
  synthesizeCioDigest,
  type AiGatewayInvokeResultDto,
  type CioDigestDto,
  type CioRole,
  type OpsAnomalyDto,
  type OpsForecastDto,
  type OrgCommsChannelDto,
  type OrgCommsMessageDto,
  type RevenueSuggestionDto,
  type EnergySuggestionDto,
  type SynthesizedCioDigestDto,
  type TrustedSourceCategory,
  type TrustedSourceDto,
} from "@hotelos/web-client";

const TRUSTED_CATEGORIES: readonly {
  value: TrustedSourceCategory;
  labelHe: string;
}[] = [
  { value: "regulator", labelHe: "רגולטור" },
  { value: "university", labelHe: "אוניברסיטה / מחקר" },
  { value: "market_data", labelHe: "נתוני שוק" },
  { value: "accounting_standard", labelHe: "תקן חשבונאות" },
  { value: "kashrut_authority", labelHe: "רשות כשרות" },
  { value: "other", labelHe: "אחר" },
];

const ROLE_OPTIONS: readonly { value: CioRole; labelHe: string }[] = [
  { value: "owner", labelHe: "בעל מלון / רשת" },
  { value: "ceo", labelHe: "מנכ״ל" },
  { value: "cfo", labelHe: "כספים" },
  { value: "reception", labelHe: "קבלה" },
  { value: "housekeeping", labelHe: "חדרים / משק בית" },
  { value: "fb", labelHe: "מזון ומשקאות (F&B)" },
];

export function CioDigestPage() {
  const [role, setRole] = useState<CioRole>("ceo");
  const [digest, setDigest] = useState<CioDigestDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const [channels, setChannels] = useState<readonly OrgCommsChannelDto[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<readonly OrgCommsMessageDto[]>([]);
  const [draft, setDraft] = useState("");
  const [sources, setSources] = useState<readonly TrustedSourceDto[]>([]);
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceCategory, setSourceCategory] =
    useState<TrustedSourceCategory>("regulator");
  const [creatingSource, setCreatingSource] = useState(false);
  const [ask, setAsk] = useState("מה דורש תשומת לב ברשת היום?");
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState<string | undefined>();
  const [askResult, setAskResult] = useState<AiGatewayInvokeResultDto | null>(
    null,
  );
  const [gatewayProvider, setGatewayProvider] = useState<string>("…");
  const [smart, setSmart] = useState<SynthesizedCioDigestDto | null>(null);
  const [smartLoading, setSmartLoading] = useState(false);
  const [notice, setNotice] = useState<string | undefined>();
  const [busyAction, setBusyAction] = useState<string | undefined>();
  const [anomalies, setAnomalies] = useState<readonly OpsAnomalyDto[]>([]);
  const [forecast, setForecast] = useState<OpsForecastDto | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [revenueSuggestions, setRevenueSuggestions] = useState<
    readonly RevenueSuggestionDto[]
  >([]);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [revenueBusyId, setRevenueBusyId] = useState<string | undefined>();
  const [energySuggestions, setEnergySuggestions] = useState<
    readonly EnergySuggestionDto[]
  >([]);
  const [energyLoading, setEnergyLoading] = useState(false);
  const [energyBusyId, setEnergyBusyId] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(undefined);
      setSmart(null);
      try {
        const [data, anomalyRows] = await Promise.all([
          fetchCioDigest(role),
          fetchOpsAnomalies(),
        ]);
        if (!cancelled) setAnomalies(anomalyRows);
        if (!cancelled) setDigest(data);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "שגיאה בטעינת התדריך");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [role]);

  useEffect(() => {
    const hotelId = digest?.sections[0]?.hotelId;
    if (!hotelId) {
      setForecast(null);
      setRevenueSuggestions([]);
      setEnergySuggestions([]);
      return;
    }
    let cancelled = false;
    async function loadForecastAndRevenue() {
      if (!hotelId) return;
      setForecastLoading(true);
      setRevenueLoading(true);
      setEnergyLoading(true);
      try {
        const [forecastData, suggestions, energyRows] = await Promise.all([
          fetchOpsForecast(hotelId),
          fetchRevenueSuggestions(hotelId),
          fetchEnergySuggestions(hotelId),
        ]);
        if (cancelled) return;
        setForecast(forecastData);
        setRevenueSuggestions(suggestions);
        setEnergySuggestions(energyRows);
      } catch {
        if (!cancelled) {
          setForecast(null);
          setRevenueSuggestions([]);
          setEnergySuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setForecastLoading(false);
          setRevenueLoading(false);
          setEnergyLoading(false);
        }
      }
    }
    void loadForecastAndRevenue();
    return () => {
      cancelled = true;
    };
  }, [digest?.sections]);

  async function onGenerateRevenueSuggestions() {
    const hotelId = digest?.sections[0]?.hotelId;
    if (!hotelId) {
      setError("אין מלון בתדריך — לא ניתן ליצור הצעות תמחור");
      return;
    }
    setRevenueLoading(true);
    setError(undefined);
    try {
      const result = await generateRevenueSuggestions(hotelId);
      setRevenueSuggestions(result.suggestions);
      setNotice(`נוצרו ${result.suggestions.length} הצעות תמחור ל-${result.hotelName}.`);
    } catch (genError) {
      setError(
        genError instanceof Error ? genError.message : "יצירת הצעות תמחור נכשלה",
      );
    } finally {
      setRevenueLoading(false);
    }
  }

  async function onDecideRevenueSuggestion(
    suggestionId: string,
    status: "approved" | "rejected",
  ) {
    setRevenueBusyId(suggestionId);
    setError(undefined);
    try {
      const updated = await decideRevenueSuggestion(suggestionId, status);
      setRevenueSuggestions((prev) =>
        prev.map((row) => (row.id === updated.id ? updated : row)),
      );
      setNotice(
        status === "approved"
          ? "הצעת תמחור אושרה — אין עדכון PMS אוטומטי."
          : "הצעת תמחור נדחתה.",
      );
    } catch (decideError) {
      setError(
        decideError instanceof Error
          ? decideError.message
          : "עדכון סטטוס הצעת תמחור נכשל",
      );
    } finally {
      setRevenueBusyId(undefined);
    }
  }

  async function onGenerateEnergySuggestions() {
    const hotelId = digest?.sections[0]?.hotelId;
    if (!hotelId) {
      setError("אין מלון בתדריך — לא ניתן ליצור הצעות אנרגיה");
      return;
    }
    setEnergyLoading(true);
    setError(undefined);
    try {
      const result = await generateEnergySuggestions(hotelId);
      setEnergySuggestions(result.suggestions);
      setNotice(
        `נוצרו ${result.suggestions.length} הצעות אנרגיה ל-${result.periodDate}.`,
      );
    } catch (genError) {
      setError(
        genError instanceof Error ? genError.message : "יצירת הצעות אנרגיה נכשלה",
      );
    } finally {
      setEnergyLoading(false);
    }
  }

  async function onDecideEnergySuggestion(
    suggestionId: string,
    decision: "accepted" | "dismissed",
  ) {
    const hotelId = digest?.sections[0]?.hotelId;
    if (!hotelId) {
      setError("אין מלון בתדריך");
      return;
    }
    setEnergyBusyId(suggestionId);
    setError(undefined);
    try {
      const updated = await decideEnergySuggestion(
        hotelId,
        suggestionId,
        decision,
      );
      setEnergySuggestions((prev) =>
        prev.map((row) => (row.id === updated.id ? updated : row)),
      );
      setNotice(
        decision === "accepted"
          ? "הצעת אנרגיה אושרה — אין שליטה BMS אוטומטית."
          : "הצעת אנרגיה נדחתה.",
      );
    } catch (decideError) {
      setError(
        decideError instanceof Error
          ? decideError.message
          : "עדכון סטטוס הצעת אנרגיה נכשל",
      );
    } finally {
      setEnergyBusyId(undefined);
    }
  }

  async function onSynthesize() {
    setSmartLoading(true);
    setError(undefined);
    try {
      const result = await synthesizeCioDigest(role);
      setDigest(result.digest);
      setSmart(result);
      setGatewayProvider(result.provider);
    } catch (synthError) {
      setError(
        synthError instanceof Error ? synthError.message : "סינתזת תדריך נכשלה",
      );
    } finally {
      setSmartLoading(false);
    }
  }

  async function onCreateTrustedSource() {
    if (!sourceTitle.trim() || !sourceUrl.trim()) {
      setError("מלאו כותרת וכתובת URL למקור Trusted");
      return;
    }
    setCreatingSource(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const created = await createTrustedSource({
        title: sourceTitle.trim(),
        url: sourceUrl.trim(),
        category: sourceCategory,
      });
      setSources((prev) => [...prev, created]);
      setSourceTitle("");
      setSourceUrl("");
      setSourceCategory("regulator");
      setNotice("מקור Trusted נוסף — ייכנס ל־context pack ב־Gateway.");
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "הוספת מקור Trusted נכשלה",
      );
    } finally {
      setCreatingSource(false);
    }
  }

  async function onSuggestAction(actionHe: string) {
    const hotelId = digest?.sections[0]?.hotelId;
    if (!hotelId) {
      setError("אין מלון בתדריך — לא ניתן לשלוח Suggest");
      return;
    }
    setBusyAction(actionHe);
    setError(undefined);
    try {
      const result = await suggestAutonomyBriefingAction({
        hotelId,
        actionHe,
        roleHint: role,
        source: "cio_digest",
      });
      setNotice(
        `Suggest נשלח לאישורי AI → ${result.departmentCode} (${result.approvalId.slice(0, 8)}…).`,
      );
    } catch (suggestError) {
      setError(
        suggestError instanceof Error
          ? suggestError.message
          : "הצעת פעולה מתדריך נכשלה",
      );
    } finally {
      setBusyAction(undefined);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [channelList, sourceList, gatewayStatus] = await Promise.all([
          listOrgCommsChannels(),
          listTrustedSources(),
          fetchAiGatewayStatus(),
        ]);
        if (cancelled) return;
        setChannels(channelList);
        setSources(sourceList);
        setGatewayProvider(gatewayStatus.primaryProvider);
        const firstChannel = channelList[0];
        if (firstChannel) setSelectedChannelId(firstChannel.id);
      } catch {
        // Org comms / knowledge are secondary panels — digest above still works.
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!selectedChannelId) {
        setMessages([]);
        return;
      }
      try {
        const list = await listOrgCommsMessages(selectedChannelId);
        if (!cancelled) setMessages(list);
      } catch {
        if (!cancelled) setMessages([]);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedChannelId]);

  async function onSend() {
    if (!selectedChannelId || draft.trim().length === 0) return;
    await postOrgCommsMessage(selectedChannelId, {
      fromRole: role,
      body: draft.trim(),
    });
    setDraft("");
    setMessages(await listOrgCommsMessages(selectedChannelId));
  }

  async function onAskGateway() {
    if (ask.trim().length === 0) return;
    setAskLoading(true);
    setAskError(undefined);
    try {
      const contextPack = digest
        ? [digest.headlineHe, ...digest.sections.flatMap((s) => s.bulletsHe)].join(
            "\n",
          )
        : undefined;
      const result = await invokeAiGateway({
        agentId: "agent.cio",
        message: ask.trim(),
        locale: "he",
        ...(contextPack !== undefined ? { contextPack } : {}),
      });
      setAskResult(result);
      setGatewayProvider(result.provider);
    } catch (invokeError) {
      setAskError(
        invokeError instanceof Error ? invokeError.message : "שגיאת Gateway",
      );
    } finally {
      setAskLoading(false);
    }
  }

  return (
    <div className="cio-page">
      <header>
        <p className="hotelos-eyebrow">ADR 0007 · ADR 0008 · AI Gateway</p>
        <h1>יועץ־על (CIO)</h1>
        <p className="sub">
          תדריך יומי לפי תפקיד + סיכום חכם דרך AI Gateway (ספק:{" "}
          {gatewayProvider}). בלי מפתח — מצב דטרמיניסטי; עם AI_GATEWAY_API_KEY —
          LLM תואם OpenAI.
        </p>
      </header>

      <section className="card">
        <h2>אנומליות לסף (כללים)</h2>
        <p className="hint">
          מלאי נמוך, תחזוקה דחופה חורגת SLA, רכש/יומן מעל ₪2,000, וסגירות מהירות
          ללא תיעוד — בלי ביצוע כספי אוטונומי.
        </p>
        {anomalies.length === 0 ? (
          <p className="hint">לא זוהו אנומליות לפי כללי הסף כרגע.</p>
        ) : (
          <ul className="anomaly-list">
            {anomalies.map((row) => (
              <li key={row.fingerprint}>
                <strong>
                  [{row.severity}] {row.titleHe}
                </strong>
                <span>{row.evidenceHe}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>תחזית 7 ימים (Forecast Center)</h2>
        <p className="hint">
          הגעות/יציאות, תפוסה משוערת, תחזוקה פתוחה והנחיית כוח אדם — ללא LLM.
        </p>
        {forecastLoading ? <p className="state">טוען תחזית…</p> : null}
        {!forecastLoading && forecast ? (
          <>
            <ul className="bullets">
              {forecast.summaryBulletsHe.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
            <div className="forecast-table-wrap">
              <table className="forecast-table">
              <thead>
                <tr>
                  <th>תאריך</th>
                  <th>הגעות</th>
                  <th>יציאות</th>
                  <th>תפוסה</th>
                </tr>
              </thead>
              <tbody>
                {forecast.days.map((day) => (
                  <tr key={day.date}>
                    <td>{day.date}</td>
                    <td>{day.arrivalsCount}</td>
                    <td>{day.departuresCount}</td>
                    <td>{day.occupancyEstimatePct}%</td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </>
        ) : null}
        {!forecastLoading && !forecast ? (
          <p className="hint">טענו תדריך כדי לראות תחזית למלון הראשון בהיקף.</p>
        ) : null}
      </section>

      <section className="card">
        <h2>אופטימיזציית הכנסות (HITL)</h2>
        <p className="hint">
          הצעות שינוי מחיר לפי תפוסה — אישור/דחייה בלבד; אין כתיבה ל-PMS.
        </p>
        <Button
          type="button"
          onClick={() => void onGenerateRevenueSuggestions()}
          disabled={revenueLoading || !digest?.sections[0]?.hotelId}
        >
          {revenueLoading ? "מחשב…" : "צור הצעות תמחור (7 ימים)"}
        </Button>
        {revenueSuggestions.length === 0 ? (
          <p className="hint">אין הצעות תמחור שמורות — לחצו ליצירה.</p>
        ) : (
          <ul className="revenue-list">
            {revenueSuggestions.map((row) => (
              <li key={row.id} className="revenue-row">
                <div>
                  <strong>
                    {row.periodStart}
                    {row.suggestedDeltaPct > 0
                      ? ` · +${row.suggestedDeltaPct}%`
                      : row.suggestedDeltaPct < 0
                        ? ` · ${row.suggestedDeltaPct}%`
                        : " · החזקה"}
                  </strong>
                  <span>
                    תפוסה {row.currentOccupancyPct}% — {row.rationaleHe}
                  </span>
                  <span className="badge">סטטוס: {row.status}</span>
                </div>
                {row.status === "suggested" ? (
                  <div className="revenue-actions">
                    <Button
                      type="button"
                      onClick={() =>
                        void onDecideRevenueSuggestion(row.id, "approved")
                      }
                      disabled={revenueBusyId === row.id}
                    >
                      אשר
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        void onDecideRevenueSuggestion(row.id, "rejected")
                      }
                      disabled={revenueBusyId === row.id}
                    >
                      דחה
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" aria-labelledby="energy-heading">
        <h2 id="energy-heading">אנרגיה</h2>
        <p className="hint">
          HVAC וחשמל לפי תפוסה וקומות ריקות — אישור/דחייה בלבד; אין BMS חובה.
        </p>
        <Button
          type="button"
          onClick={() => void onGenerateEnergySuggestions()}
          disabled={energyLoading || !digest?.sections[0]?.hotelId}
        >
          {energyLoading ? "מחשב…" : "צור הצעות אנרגיה (יומי)"}
        </Button>
        {energySuggestions.length === 0 ? (
          <p className="hint">אין הצעות אנרגיה שמורות — לחצו ליצירה.</p>
        ) : (
          <ul className="revenue-list energy-list">
            {energySuggestions.map((row) => (
              <li key={row.id} className="revenue-row energy-row">
                <div>
                  <strong>
                    {row.periodDate} · תפוסה {row.occupancyPct}%
                    {row.estimatedSavingPct > 0
                      ? ` · חיסכון ~${row.estimatedSavingPct}%`
                      : ""}
                  </strong>
                  <span>{row.suggestionHe}</span>
                  <span className="badge">סטטוס: {row.status}</span>
                </div>
                {row.status === "suggested" ? (
                  <div className="revenue-actions energy-actions">
                    <Button
                      type="button"
                      onClick={() =>
                        void onDecideEnergySuggestion(row.id, "accepted")
                      }
                      disabled={energyBusyId === row.id}
                    >
                      אשר
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        void onDecideEnergySuggestion(row.id, "dismissed")
                      }
                      disabled={energyBusyId === row.id}
                    >
                      דחה
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>תדריך חכם (Gateway)</h2>
        <p className="hint">
          נתונים דטרמיניסטיים + סיכום והמלצות מ־agent.cio. אין ביצוע כספי
          אוטונומי.
        </p>
        <Button
          type="button"
          onClick={() => void onSynthesize()}
          disabled={smartLoading}
        >
          {smartLoading ? "מסכם…" : "סכם תדריך עם AI"}
        </Button>
        {notice ? (
          <p className="state state--ok" role="status">
            {notice}
          </p>
        ) : null}
        {smart ? (
          <div className="smart-block">
            <p className="narrative">{smart.narrativeHe}</p>
            {smart.citations?.length ? (
              <CitationList citations={smart.citations} />
            ) : null}
            {smart.suggestedActionsHe.length > 0 ? (
              <div>
                <h3>מומלץ היום · Suggest→Approve→Act</h3>
                <ul className="action-list">
                  {smart.suggestedActionsHe.map((action) => (
                    <li key={action}>
                      <span>{action}</span>
                      <Button
                        type="button"
                        disabled={busyAction === action}
                        onClick={() => void onSuggestAction(action)}
                      >
                        {busyAction === action ? "שולח…" : "Suggest"}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="hint">
              {smart.provider} · {smart.confidence} · {smart.latencyMs}ms
              {smart.requiresHumanApproval
                ? ` · דורש אישור אדם${smart.approvalReasonHe ? `: ${smart.approvalReasonHe}` : ""}`
                : ""}
            </p>
          </div>
        ) : null}
      </section>

      <section className="card">
        <h2>שאל את ה־Gateway</h2>
        <div className="compose">
          <TextField
            label="שאלה ליועץ־על"
            name="gatewayAsk"
            value={ask}
            onChange={(event) => setAsk(event.target.value)}
          />
          <Button
            type="button"
            onClick={() => void onAskGateway()}
            disabled={askLoading}
          >
            {askLoading ? "שולח…" : "שלח ל־Gateway"}
          </Button>
        </div>
        {askError ? (
          <p className="state state--error" role="alert">
            {askError}
          </p>
        ) : null}
        {askResult ? (
          <div className="gateway-answer">
            <p>{askResult.answerHe}</p>
            <p className="hint">
              {askResult.provider} · {askResult.confidence} · {askResult.latencyMs}
              ms
              {askResult.requiresHumanApproval
                ? ` · דורש אישור אדם${askResult.approvalReasonHe ? `: ${askResult.approvalReasonHe}` : ""}`
                : ""}
            </p>
          </div>
        ) : null}
      </section>

      <section className="card">
        <div className="role-row">
          <label htmlFor="cio-role">תפקיד</label>
          <select
            id="cio-role"
            value={role}
            onChange={(event) => setRole(event.target.value as CioRole)}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.labelHe}
              </option>
            ))}
          </select>
        </div>

        {loading ? <p className="state">מכין תדריך…</p> : null}
        {error !== undefined ? (
          <p className="state state--error" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && digest ? (
          <>
            <p className="headline">{digest.headlineHe}</p>
            <ul className="sections">
              {digest.sections.map((section) => (
                <li key={section.hotelId} className="section">
                  <h3>
                    {section.hotelName}
                    {section.kashrutEnabled ? (
                      <span className="badge">משגיח כשרות פעיל</span>
                    ) : null}
                  </h3>
                  <ul className="bullets">
                    {section.bulletsHe.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                  {section.kashrutNoteHe ? (
                    <p className="kashrut-note">🕎 {section.kashrutNoteHe}</p>
                  ) : null}
                </li>
              ))}
            </ul>
            {digest.sections.length === 0 ? (
              <p className="hint">אין עדיין נתונים מספיקים לתדריך.</p>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="card">
        <h2>Org Comms — ערוצים ישירים</h2>
        <p className="hint">
          תקשורת ישירה בין בעלים/מנכ״ל/מחלקות ומשגיח הכשרות (ADR 0007). ערוץ בעלים–מנכ״ל פרטי.
        </p>
        <div className="comms">
          <ul className="channel-list">
            {channels.map((channel) => (
              <li key={channel.id}>
                <button
                  type="button"
                  className={
                    channel.id === selectedChannelId ? "channel channel--on" : "channel"
                  }
                  onClick={() => setSelectedChannelId(channel.id)}
                >
                  {channel.nameHe}
                </button>
              </li>
            ))}
            {channels.length === 0 ? <li className="hint">אין ערוצים עדיין.</li> : null}
          </ul>
          <div className="channel-body">
            <ul className="messages">
              {messages.map((message) => (
                <li key={message.id}>
                  <strong>{message.fromRole}:</strong> {message.body}
                </li>
              ))}
              {messages.length === 0 ? (
                <li className="hint">אין הודעות בערוץ זה עדיין.</li>
              ) : null}
            </ul>
            <div className="compose">
              <TextField
                label="הודעה"
                name="orgCommsDraft"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <Button
                type="button"
                onClick={() => void onSend()}
                disabled={!selectedChannelId || draft.trim().length === 0}
              >
                שלח
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>מקורות Trusted (מודיעין חיצוני מאושר)</h2>
        <p className="hint">
          רק מקורות מאושרים ברשימה זו נכנסים ל־context pack של Gateway (CIO / CFO /
          כשרות / משפטי) — אין חיפוש פתוח ברשת.
        </p>
        <div className="compose trusted-form">
          <TextField
            label="כותרת מקור"
            name="trustedTitle"
            value={sourceTitle}
            onChange={(event) => setSourceTitle(event.target.value)}
          />
          <TextField
            label="URL"
            name="trustedUrl"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
          />
          <label className="role-row">
            קטגוריה
            <select
              value={sourceCategory}
              onChange={(event) =>
                setSourceCategory(event.target.value as TrustedSourceCategory)
              }
            >
              {TRUSTED_CATEGORIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.labelHe}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            onClick={() => void onCreateTrustedSource()}
            disabled={creatingSource}
          >
            {creatingSource ? "מוסיף…" : "הוסף מקור Trusted"}
          </Button>
        </div>
        <ul className="sources">
          {sources.map((source) => (
            <li key={source.id}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.title}
              </a>
              <span className="category">{source.category}</span>
            </li>
          ))}
          {sources.length === 0 ? <li className="hint">אין מקורות מאושרים עדיין.</li> : null}
        </ul>
      </section>

      <style>{`
        .cio-page { display:grid; gap:var(--space-5); align-content:start; animation:hotelos-enter var(--motion-med) var(--ease-out) both; }
        .cio-page .hotelos-eyebrow { margin-bottom:var(--space-2); }
        h1 { font-size:var(--text-display); margin:0; }
        .sub { margin:var(--space-2) 0 0; color:var(--color-ink-soft); max-width:70ch; font-weight:500; }
        .card { background:var(--color-paper-elevated); border:1px solid var(--color-line); border-radius:var(--radius-md); box-shadow:var(--shadow-soft); padding:clamp(1.2rem,2.5vw,1.8rem); display:grid; gap:var(--space-3); }
        .card h2 { margin:0; font-size:var(--text-title); }
        .role-row { display:flex; gap:var(--space-2); align-items:center; }
        .role-row select { font:inherit; border:1px solid var(--color-line-strong); border-radius:var(--radius-sm); padding:.55rem .7rem; background:#fff; }
        .headline { margin:0; font-weight:700; }
        .state { margin:0; color:var(--color-ink-soft); font-weight:500; }
        .state--error { color:var(--color-danger); }
        .state--ok { color:var(--color-sea-deep); background:var(--color-sea-soft); padding:.75rem 1rem; border-radius:var(--radius-sm); border:1px solid rgb(14 107 92 / 16%); font-weight:600; }
        .hint { margin:0; color:var(--color-ink-soft); font-weight:500; }
        .smart-block { display:grid; gap:var(--space-3); border-top:1px solid var(--color-line); padding-top:var(--space-3); }
        .narrative { margin:0; white-space:pre-wrap; line-height:1.55; }
        .smart-block h3 { margin:0; font-size:var(--text-micro); text-transform:uppercase; letter-spacing:var(--tracking-label); color:var(--color-ink-soft); }
        .action-list { list-style:none; margin:0; padding:0; display:grid; gap:.5rem; }
        .action-list li { display:flex; justify-content:space-between; gap:.75rem; align-items:center; padding:.65rem .75rem; border:1px solid var(--color-line); border-radius:var(--radius-sm); background:#fff; }
        .action-list li span { flex:1; }
        .sections { list-style:none; margin:0; padding:0; display:grid; gap:var(--space-3); }
        .section { padding:var(--space-3); border-radius:var(--radius-sm); background:#fff; border:1px solid var(--color-line); display:grid; gap:var(--space-2); }
        .section h3 { margin:0; display:flex; gap:var(--space-2); align-items:center; }
        .badge { font-size:var(--text-micro); font-weight:700; color:var(--color-sea-deep); background:var(--color-sea-soft); border-radius:var(--radius-pill); padding:.2rem .6rem; }
        .bullets { margin:0; padding-inline-start:1.2rem; display:grid; gap:.2rem; }
        .kashrut-note { margin:0; font-weight:600; }
        .comms { display:grid; grid-template-columns:220px 1fr; gap:var(--space-3); }
        .channel-list { list-style:none; margin:0; padding:0; display:grid; gap:.3rem; }
        .channel { width:100%; text-align:start; font:inherit; border:1px solid var(--color-line); background:var(--color-paper-elevated); border-radius:var(--radius-sm); padding:.5rem .7rem; cursor:pointer; }
        .channel--on { border-color:var(--color-sea-deep); color:var(--color-sea-deep); font-weight:700; }
        .channel-body { display:grid; gap:var(--space-3); align-content:start; }
        .messages { list-style:none; margin:0; padding:0; display:grid; gap:.4rem; max-height:220px; overflow:auto; }
        .messages li { padding:.5rem .7rem; border-radius:var(--radius-sm); background:var(--color-paper-elevated); }
        .compose { display:flex; gap:var(--space-2); align-items:end; flex-wrap:wrap; }
        .compose > :first-child { flex:1; min-width:200px; }
        .sources { list-style:none; margin:0; padding:0; display:grid; gap:.4rem; }
        .sources li { display:flex; justify-content:space-between; gap:var(--space-2); padding:.5rem .7rem; border-radius:var(--radius-sm); background:var(--color-paper-elevated); }
        .anomaly-list { list-style:none; margin:0; padding:0; display:grid; gap:.45rem; }
        .anomaly-list li { display:grid; gap:.15rem; padding:.55rem .7rem; border-radius:var(--radius-sm); background:var(--color-paper-elevated); border:1px solid var(--color-line); }
        .anomaly-list span { color:var(--color-ink-soft); font-size:var(--text-small); }
        .category { font-size:var(--text-small); color:var(--color-ink-soft); }
        .gateway-answer { padding:var(--space-3); border-radius:var(--radius-sm); background:var(--color-paper-elevated); display:grid; gap:var(--space-2); white-space:pre-wrap; }
        .forecast-table-wrap { overflow-x:auto; -webkit-overflow-scrolling:touch; max-width:100%; }
        .forecast-table { width:100%; border-collapse:collapse; min-width:18rem; }
        .forecast-table th, .forecast-table td { padding:.5rem .65rem; text-align:start; border-bottom:1px solid var(--color-line); font-size:var(--text-small); }
        .forecast-table th { color:var(--color-ink-soft); font-weight:700; }
        @media (max-width:768px){ .comms{ grid-template-columns:1fr; } }
        @media (max-width:480px){
          .compose > :first-child { min-width:0; width:100%; }
          .action-list li { flex-direction:column; align-items:stretch; }
        }
      `}</style>
    </div>
  );
}
