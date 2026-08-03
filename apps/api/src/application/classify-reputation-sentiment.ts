import type { ReputationSentiment } from "@hotelos/database";

const NEGATIVE_KEYWORDS: readonly string[] = [
  "terrible",
  "awful",
  "horrible",
  "disgusting",
  "dirty",
  "rude",
  "worst",
  "bad",
  "poor",
  "unacceptable",
  "disappointed",
  "disappointing",
  "never again",
  "avoid",
  "filthy",
  "broken",
  "noisy",
  "smell",
  "mold",
  "bedbugs",
  "bed bugs",
  "נורא",
  "גרוע",
  "מזעזע",
  "מלוכלך",
  "מגעיל",
  "לא מומלץ",
  "אכזבה",
  "אכזבתי",
  "לא חזור",
  "לא נקי",
  "רעש",
  "רועש",
  "מסריח",
  "שבור",
  "לא מקצועי",
  "חצוף",
  "לא יחזור",
];

const POSITIVE_KEYWORDS: readonly string[] = [
  "excellent",
  "amazing",
  "wonderful",
  "perfect",
  "great",
  "fantastic",
  "lovely",
  "recommend",
  "highly recommend",
  "outstanding",
  "beautiful",
  "friendly",
  "clean",
  "comfortable",
  "מעולה",
  "נפלא",
  "מושלם",
  "מומלץ",
  "מומלץ בחום",
  "נהדר",
  "יפה",
  "נקי",
  "נעים",
  "חמים",
  "אדיב",
  "שירות מעולה",
];

const TOPIC_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  cleanliness: [
    "dirty",
    "clean",
    "filthy",
    "hygiene",
    "stain",
    "mold",
    "נקי",
    "מלוכלך",
    "לכלוך",
    "ניקיון",
  ],
  staff: [
    "rude",
    "staff",
    "reception",
    "front desk",
    "service",
    "friendly",
    "אדיב",
    "חצוף",
    "צוות",
    "קבלה",
    "שירות",
  ],
  room: [
    "room",
    "bed",
    "bathroom",
    "shower",
    "mattress",
    "pillow",
    "ac",
    "air conditioning",
    "חדר",
    "מיטה",
    "אמבטיה",
    "מזגן",
  ],
  food: [
    "breakfast",
    "restaurant",
    "food",
    "dinner",
    "lunch",
    "buffet",
    "ארוחת בוקר",
    "מסעדה",
    "אוכל",
  ],
  noise: ["noisy", "noise", "loud", "quiet", "רעש", "רועש", "שקט"],
  location: ["location", "parking", "walk", "beach", "מיקום", "חניה", "חוף"],
  value: ["price", "expensive", "cheap", "value", "worth", "מחיר", "יקר", "זול"],
};

function countMatches(text: string, keywords: readonly string[]): number {
  const lower = text.toLowerCase();
  let count = 0;
  for (const keyword of keywords) {
    if (lower.includes(keyword.toLowerCase())) {
      count += 1;
    }
  }
  return count;
}

export function extractReputationTopics(text: string): readonly string[] {
  const lower = text.toLowerCase();
  const topics: string[] = [];
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword.toLowerCase()))) {
      topics.push(topic);
    }
  }
  return topics;
}

/**
 * Deterministic sentiment for MVP — rating thresholds plus Hebrew/English keywords.
 */
export function classifyReputationSentiment(
  rating: number,
  body: string,
  title?: string,
): ReputationSentiment {
  const text = `${title ?? ""} ${body}`.trim();
  const negativeHits = countMatches(text, NEGATIVE_KEYWORDS);
  const positiveHits = countMatches(text, POSITIVE_KEYWORDS);

  if (rating <= 2 || negativeHits >= 2) {
    return "negative";
  }
  if (rating <= 3 && negativeHits >= 1 && positiveHits === 0) {
    return "negative";
  }
  if (rating >= 4 && negativeHits === 0) {
    return positiveHits >= 1 || rating >= 5 ? "positive" : "neutral";
  }
  if (rating >= 4 && positiveHits > negativeHits) {
    return "positive";
  }
  if (rating === 3) {
    if (negativeHits > positiveHits) return "negative";
    if (positiveHits > negativeHits) return "positive";
    return "neutral";
  }
  if (negativeHits > positiveHits) {
    return "negative";
  }
  if (positiveHits > negativeHits && rating >= 4) {
    return "positive";
  }
  return rating <= 3 ? "neutral" : "positive";
}

export function reputationNeedsFollowUp(
  rating: number,
  sentiment: ReputationSentiment,
): boolean {
  return rating <= 3 || sentiment === "negative";
}
