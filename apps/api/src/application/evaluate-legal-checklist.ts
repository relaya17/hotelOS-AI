import type { LetterKind, PersistedLetterDraft } from "@hotelos/database";

export type LegalChecklistItemStatus = "pass" | "fail" | "needs_ack";

export type LegalChecklistItem = {
  readonly id: string;
  readonly labelHe: string;
  readonly required: boolean;
  readonly status: LegalChecklistItemStatus;
  readonly detailHe: string;
};

export type LegalChecklistResult = {
  readonly draftId: string;
  readonly kind: LetterKind;
  readonly applies: boolean;
  readonly gateHe: string;
  readonly items: readonly LegalChecklistItem[];
  readonly requiredItemIds: readonly string[];
  readonly autoPassedItemIds: readonly string[];
  readonly blockingItemIds: readonly string[];
  readonly canApproveWithoutAck: boolean;
};

const CONTRACT_KINDS: readonly LetterKind[] = [
  "formal_letter",
  "purchase_note",
];

/**
 * Deterministic legal checklist gate for correspondence (agent.legal / correspondence-agent).
 * Not legal advice — blocks silent approve of contractual drafts until human ack.
 */
export function evaluateLegalChecklist(
  draft: PersistedLetterDraft,
): LegalChecklistResult {
  if (!CONTRACT_KINDS.includes(draft.kind)) {
    return {
      draftId: draft.id,
      kind: draft.kind,
      applies: false,
      gateHe: "נאום/טיוטה לא-חוזית — שער Legal לא חובה.",
      items: [],
      requiredItemIds: [],
      autoPassedItemIds: [],
      blockingItemIds: [],
      canApproveWithoutAck: true,
    };
  }

  const text = `${draft.subject}\n${draft.recipientLabel}\n${draft.body}`;
  const items: LegalChecklistItem[] = [];

  items.push(evaluateParties(draft));
  items.push(evaluatePlaceholders(text));
  items.push(evaluateBindingLegalStance(text));
  if (draft.kind === "purchase_note") {
    items.push(evaluateAmountOrNa(text));
    items.push(evaluateVendorTermsHint(text));
  } else {
    items.push(evaluateCommitmentsHint(text));
  }
  items.push({
    id: "human_legal_review",
    labelHe: "אישור אנושי: אין זו ייעוץ משפטי מחייב",
    required: true,
    status: "needs_ack",
    detailHe:
      "אני מאשר/ת שבדקתי את הטיוטה; פרשנות משפטית מחייבת דורשת עו״ד אנושי לפי agent.legal.",
  });

  const requiredItemIds = items.filter((i) => i.required).map((i) => i.id);
  const autoPassedItemIds = items
    .filter((i) => i.required && i.status === "pass")
    .map((i) => i.id);
  const blockingItemIds = items
    .filter((i) => i.required && i.status !== "pass")
    .map((i) => i.id);

  return {
    draftId: draft.id,
    kind: draft.kind,
    applies: true,
    gateHe:
      "מסמך בעל משמעות חוזית/רכש — נדרש צ'קליסט agent.legal לפני אישור טיוטה.",
    items,
    requiredItemIds,
    autoPassedItemIds,
    blockingItemIds,
    canApproveWithoutAck: blockingItemIds.length === 0,
  };
}

export function missingLegalAcks(
  checklist: LegalChecklistResult,
  acknowledgedItemIds: readonly string[],
): readonly string[] {
  if (!checklist.applies) return [];
  const ack = new Set(acknowledgedItemIds);
  return checklist.blockingItemIds.filter((id) => !ack.has(id));
}

function evaluateParties(draft: PersistedLetterDraft): LegalChecklistItem {
  const recipientOk = draft.recipientLabel.trim().length >= 2;
  const hotelMention =
    /מלון|רשת|HotelOS|החברה|המזמין|הספק/i.test(draft.body) ||
    draft.subject.length >= 2;
  const pass = recipientOk && hotelMention;
  return {
    id: "parties",
    labelHe: "זהות הצדדים ברורה (נמען + שולח/מלון)",
    required: true,
    status: pass ? "pass" : "fail",
    detailHe: pass
      ? "נמצאו נמען והקשר שולח/מלון בטיוטה."
      : "חסר זיהוי ברור של הצדדים — השלימו לפני אישור או סמנו ידנית לאחר בדיקה.",
  };
}

function evaluatePlaceholders(text: string): LegalChecklistItem {
  const placeholders = (text.match(/\[יש להשלים ידנית\]/g) ?? []).length;
  const pass = placeholders === 0;
  return {
    id: "placeholders_resolved",
    labelHe: "אין שדות [יש להשלים ידנית] פתוחים",
    required: true,
    status: pass ? "pass" : "fail",
    detailHe: pass
      ? "לא נמצאו מצייני השלמה."
      : `נמצאו ${placeholders} מציינים להשלמה ידנית — יש להשלים או לאשר במודע.`,
  };
}

function evaluateBindingLegalStance(text: string): LegalChecklistItem {
  const binding =
    /עמדה משפטית מחייבת|ייעוץ משפטי מחייב|כעורך דין|חוות דעת משפטית מחייבת|אין ערעור|ויתור על תביעה/i.test(
      text,
    );
  return {
    id: "no_binding_legal_stance",
    labelHe: "אין ניסוח של עמדה משפטית מחייבת",
    required: true,
    status: binding ? "fail" : "pass",
    detailHe: binding
      ? "הטיוטה נשמעת כעמדה משפטית מחייבת — חובה ייעוץ עו״ד אנושי לפני אישור."
      : "לא זוהה ניסוח של עמדה משפטית מחייבת (בדיקה היוריסטית).",
  };
}

function evaluateAmountOrNa(text: string): LegalChecklistItem {
  const hasAmount = /₪|\bILS\b|שקל|סכום|מחיר|עלות|\d{2,}/i.test(text);
  const markedNa = /סכום[:\s]*N\/A|ללא התחייבות כספית|אין סכום/i.test(text);
  const pass = hasAmount || markedNa;
  return {
    id: "amount_or_na",
    labelHe: "סכום / התחייבות כספית מצוינים או מסומנים N/A",
    required: true,
    status: pass ? "pass" : "needs_ack",
    detailHe: pass
      ? "נמצא אזכור סכום או סימון שאין התחייבות כספית."
      : "לא זוהה סכום — ודאו שאין התחייבות מעל סף ₪2,000 בלי אישור מנהל.",
  };
}

function evaluateVendorTermsHint(text: string): LegalChecklistItem {
  const hints =
    /תנאי תשלום|מועד אספקה|אחריות|ביטול|החזרה|SLA|תקופת ההסכם/i.test(text);
  return {
    id: "vendor_terms",
    labelHe: "תנאי ספק בסיסיים נבדקו (תשלום/אספקה/אחריות)",
    required: true,
    status: hints ? "pass" : "needs_ack",
    detailHe: hints
      ? "נמצאו רמזים לתנאי ספק בטיוטה."
      : "לא זוהו תנאי ספק מפורשים — סמנו לאחר בדיקה מול רשימת חוזה ספק.",
  };
}

function evaluateCommitmentsHint(text: string): LegalChecklistItem {
  const commitment =
    /מתחייבים|התחייבות|נסכם כי|הסכם|חוזה|יחול|בתוקף|תשלום|פיצוי/i.test(
      text,
    );
  return {
    id: "commitments_reviewed",
    labelHe: "נבדקו התחייבויות/ניסוחים חוזיים במכתב",
    required: true,
    status: commitment ? "needs_ack" : "pass",
    detailHe: commitment
      ? "זוהו ניסוחי התחייבות — אשרו ידנית שאין מחויבות לא מכוונת."
      : "לא זוהו ניסוחי התחייבות חזקים (בדיקה היוריסטית).",
  };
}
