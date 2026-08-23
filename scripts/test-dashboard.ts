import assert from "node:assert/strict";
import { getPeriodRange, growthPercentage, projectGrandTotal } from "../lib/dashboard";

// One project with multiple creators is summed once at project level.
const projectValue = projectGrandTotal([
  { drf_markup_price: 1_000_000, drf_qty: 1 },
  { drf_markup_price: 2_000_000, drf_qty: 2 },
], 12);
// subtotal 5,000,000; DPP round(11/12 subtotal); PPN 12% DPP.
assert.equal(projectValue, 5_550_000);

assert.equal(growthPercentage(0, 0), 0);
assert.equal(growthPercentage(100, 0), null);
assert.equal(growthPercentage(120, 100), 20);
assert.equal(growthPercentage(80, 100), -20);

const now = new Date(2026, 7, 8);
const lastMonth = getPeriodRange("last_month", now);
assert.equal(lastMonth.start.getFullYear(), 2026);
assert.equal(lastMonth.start.getMonth(), 6);
assert.equal(lastMonth.end.getMonth(), 7);

const sixMonths = getPeriodRange("last_6_months", now);
assert.equal(sixMonths.start.getMonth(), 2);
assert.equal(sixMonths.end.getMonth(), 8);

console.log("Dashboard calculation tests: PASS");
