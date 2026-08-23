export type ProjectNumberPrefix = "PRJ" | "TRS" | "QUO" | "INV";

function numericPart(value: string | null | undefined) {
  return String(value ?? "").replace(/^[A-Za-z]+-?/, "").replace(/\D/g, "");
}

export function normalizeProjectNumber(
  prefix: ProjectNumberPrefix,
  value: string | null | undefined,
  transactionNumber?: string | null,
) {
  const digits = numericPart(value) || numericPart(transactionNumber);
  return digits ? `${prefix}-${digits}` : "";
}

export function createTransactionNumber(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const unique = String(now.getTime()).slice(-6);
  return `TRS-${year}${month}${day}-${unique}`;
}
