// Writes index.json, the shipping price list the storefront and the admin read, from Geliver's price list: one row per
// carrier and desi (0–30). Run monthly by .github/workflows/update-prices.yml; GELIVER_TOKEN is a repository secret
import { writeFile } from "node:fs/promises";

// Geliver's list carries only the carrier codes; the storefront shows these names and logos
const CARRIERS = {
  HEPSIJET: { name: "HepsiJet", logo: "https://app.geliver.io/hepsijetlogo.svg" },
  SURAT: { name: "Sürat Kargo", logo: "https://app.geliver.io/suratkargologo.png" },
  PTT: { name: "Ptt Kargo", logo: "https://app.geliver.io/pttkargo.png" },
  KOLAYGELSIN: { name: "Kolay Gelsin", logo: "https://app.geliver.io/kolaygelsinlogo.svg" },
  ARAS: { name: "Aras Kargo", logo: "https://app.geliver.io/aras-logo.svg" },
  YURTICI: { name: "Yurtiçi Kargo", logo: "https://app.geliver.io/yurticikargologo.png" },
};
const DESIS = 31;

const response = await fetch("https://api.geliver.io/api/v1/priceList?paramType=all", {
  headers: { Authorization: `Bearer ${process.env.GELIVER_TOKEN}` },
});
if (!response.ok) throw new Error(`Geliver answered ${response.status}`);
const { result, priceList } = await response.json();
if (!result || !Array.isArray(priceList)) throw new Error("Geliver sent no price list");

const rows = [];
for (const { desi, offers } of priceList) {
  // A carrier can come once per transport type (in-city, intercity); the higher price is kept, so no parcel costs
  // more than the list says
  const byCarrier = new Map();
  for (const offer of offers) {
    if (!CARRIERS[offer.providerCode]) continue;
    const kept = byCarrier.get(offer.providerCode);
    if (!kept || Number(offer.totalAmount) > Number(kept.totalAmount)) byCarrier.set(offer.providerCode, offer);
  }
  for (const offer of byCarrier.values()) {
    rows.push({
      _id: String(rows.length),
      ...CARRIERS[offer.providerCode],
      desi,
      providerCode: offer.providerCode,
      amount: offer.amount,
      amountVat: offer.amountVat,
      amountTax: offer.amountTax,
      totalAmount: offer.totalAmount,
      currency: offer.currency,
    });
  }
}

// A list short of a carrier or a desi would leave prices missing on the sites, so the old file stays then
const expected = DESIS * Object.keys(CARRIERS).length;
if (rows.length !== expected) throw new Error(`Expected ${expected} prices, got ${rows.length}`);

await writeFile("index.json", `${JSON.stringify(rows, null, 2)}\n`);
console.log(`index.json: ${rows.length} prices`);
