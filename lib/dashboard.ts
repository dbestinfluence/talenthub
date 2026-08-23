import { calculateTaxSummary } from "@/lib/tax";

export type DashboardPeriod = "this_month" | "last_month" | "last_3_months" | "last_6_months" | "this_year";

export function getPeriodRange(period: DashboardPeriod, now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = period === "last_month"
    ? new Date(year, month - 1, 1)
    : period === "last_3_months"
      ? new Date(year, month - 2, 1)
      : period === "last_6_months"
        ? new Date(year, month - 5, 1)
        : period === "this_year"
          ? new Date(year, 0, 1)
          : new Date(year, month, 1);
  const end = period === "last_month"
    ? new Date(year, month, 1)
    : new Date(year, month + 1, 1);
  return { start, end };
}

export function projectGrandTotal(
  details: Array<{ drf_markup_price: unknown; drf_qty: number | null }>,
  taxRate: unknown,
) {
  const subtotal = details.reduce(
    (sum, detail) => sum + Number(detail.drf_markup_price ?? 0) * Number(detail.drf_qty ?? 0),
    0,
  );
  return calculateTaxSummary(subtotal, Number(taxRate ?? 11)).grandTotal;
}

export function projectFinancialSummary(
  details: Array<{ drf_markup_price: unknown; drf_qty: number | null }>,
  taxRate: unknown,
) {
  const grossIncome = details.reduce(
    (sum, detail) => sum + Number(detail.drf_markup_price ?? 0) * Number(detail.drf_qty ?? 0),
    0,
  );
  const taxDeduction = calculateTaxSummary(grossIncome, Number(taxRate ?? 11)).ppn;
  return { grossIncome, taxDeduction, netIncome: Math.max(0, grossIncome - taxDeduction) };
}

export function growthPercentage(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function addDays(value: Date, days: number) {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
}

export function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}
