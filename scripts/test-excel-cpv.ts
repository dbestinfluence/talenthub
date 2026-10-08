import assert from "node:assert/strict";
import { createExcelWorkbook } from "../lib/excelExport";

const workbook = createExcelWorkbook([{
  name: "Creator A", username: "creatora", followers: 1000, totalPost: 10,
  engagementRate: 0.05, averageView: 200, averageViewBrand: 100,
  // Deliberately stale CPV values: the exporter must recalculate from Mark
  // Price and Average View instead of trusting these UI fields.
  cpvAll: 0, cpvBranded: 0, sow: "Reels IG", platform: "Instagram",
  drf_qty: 2, markupPrice: 10_000, total: 20_000,
}], { name: "Test", brand: "Brand", createdBy: "Admin", createdAt: new Date() });

const sheet = workbook.Sheets.Creators;
assert.equal(sheet.I6.v, 50);
assert.equal(sheet.J6.v, 100);
assert.equal(sheet.I6.t, "n");
assert.equal(sheet.J6.t, "n");
assert.equal(sheet.I6.s.numFmt, '"Rp" #,##0');
assert.equal(sheet.J6.s.numFmt, '"Rp" #,##0');

const bundleWorkbook = createExcelWorkbook([
  {
    name: "Creator Bundle", username: "bundle", averageView: 200,
    averageViewBrand: 100, sow: "Reels IG", platform: "Instagram",
    drf_qty: 1, pricingType: "BUNDLE", isBundleLead: true,
    rateCard: 800_000, bundlePrice: 1_000_000, total: 1_000_000,
  },
  {
    name: "Creator Bundle", username: "bundle", averageView: 200,
    averageViewBrand: 100, sow: "Story IG", platform: "Instagram",
    drf_qty: 1, pricingType: "BUNDLE", isBundleLead: false,
    bundlePrice: 1_000_000, total: 0,
  },
], { name: "Bundle Test", brand: "Brand", createdAt: new Date() });
const bundleSheet = bundleWorkbook.Sheets.Creators;
assert.equal(bundleSheet.N6.v, "Bundling");
assert.equal(bundleSheet.O6.v, 800_000);
assert.equal(bundleSheet.P6.v, 1_000_000);
assert.equal(bundleSheet.Q6.v, 1_000_000);
assert.equal(bundleSheet.N7.v, "↳ Included");
assert.equal(bundleSheet.O7.v, "—");
assert.equal(bundleSheet.P7.v, "Included");
assert.equal(bundleSheet.Q7.v, "Included");
assert.equal(bundleSheet.I7.v, 5_000);

console.log("Excel CPV tests: PASS");
