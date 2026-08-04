/**
 * Assert apps/www/index.html JSON-LD Offer matches LIST_PRICES_USD.
 * Run from repo root: node scripts/check-www-jsonld.mjs
 * Also invoked from apps/www landing.test.ts via the same invariants.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const htmlPath = join(repoRoot, "apps/www/index.html");
const pricesPath = join(repoRoot, "apps/www/src/list-prices.ts");

const html = readFileSync(htmlPath, "utf8");
const pricesSrc = readFileSync(pricesPath, "utf8");

const currencyMatch = pricesSrc.match(/currency:\s*"([A-Z]{3})"/);
const pilotPriceMatch = pricesSrc.match(
  /pilot:\s*\{[^}]*price:\s*"(\d+)"/s,
);

if (!currencyMatch?.[1] || !pilotPriceMatch?.[1]) {
  console.error("Could not parse LIST_PRICES_USD from list-prices.ts");
  process.exit(1);
}

const expectedCurrency = currencyMatch[1];
const expectedPilotPrice = pilotPriceMatch[1];

const scriptMatch = html.match(
  /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i,
);
if (!scriptMatch?.[1]) {
  console.error("No application/ld+json script found in apps/www/index.html");
  process.exit(1);
}

let doc;
try {
  doc = JSON.parse(scriptMatch[1]);
} catch (error) {
  console.error("JSON-LD is not valid JSON:", error);
  process.exit(1);
}

const graph = Array.isArray(doc["@graph"]) ? doc["@graph"] : [doc];
const software = graph.find(
  (node) =>
    node &&
    (node["@type"] === "SoftwareApplication" ||
      (Array.isArray(node["@type"]) &&
        node["@type"].includes("SoftwareApplication"))),
);

if (!software?.offers) {
  console.error("JSON-LD missing SoftwareApplication.offers");
  process.exit(1);
}

const offer = software.offers;
const currency = offer.priceCurrency;
const price = String(offer.price);

const errors = [];
if (currency !== expectedCurrency) {
  errors.push(
    `priceCurrency: got ${JSON.stringify(currency)}, expected ${JSON.stringify(expectedCurrency)}`,
  );
}
if (price !== expectedPilotPrice) {
  errors.push(
    `price: got ${JSON.stringify(price)}, expected ${JSON.stringify(expectedPilotPrice)} (Pilot)`,
  );
}

if (errors.length > 0) {
  console.error("JSON-LD Offer drift vs list-prices.ts:\n- " + errors.join("\n- "));
  process.exit(1);
}

console.log(
  `OK: JSON-LD Offer ${expectedCurrency} ${expectedPilotPrice} matches list-prices.ts`,
);
