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

console.log("Excel CPV tests: PASS");
