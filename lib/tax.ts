export function calculateTaxSummary(subtotalValue: number, taxRateValue: number) {
  const subtotal = Math.max(0, Number(subtotalValue) || 0);
  const taxRate = Math.max(0, Number(taxRateValue) || 0);
  const dpp = Math.round(subtotal * 11 / 12);
  const ppn = Math.round(dpp * taxRate / 100);
  const grandTotal = subtotal + ppn;
  return { subtotal, dpp, ppn, grandTotal, taxRate };
}
