export type RunningValidationRow = {
  id: number;
  creatorId: number;
  pricingType?: string | null;
  bundleId?: string | null;
  planningUpload?: string | Date | null;
  actualUpload?: string | Date | null;
  linkContent?: string | null;
};

export type MissingRunningFields = Record<number, {
  planningUpload: boolean;
  actualUpload: boolean;
  linkContent: boolean;
}>;

export function runningBundleKey(row: Pick<RunningValidationRow, "creatorId" | "bundleId">) {
  return `${row.creatorId}:${row.bundleId ?? "bundle"}`;
}

export function getMissingRunningFields(rows: RunningValidationRow[]): MissingRunningFields {
  const bundleHasLink = new Map<string, boolean>();

  rows.forEach((row) => {
    if (row.pricingType !== "BUNDLE") return;
    const key = runningBundleKey(row);
    bundleHasLink.set(
      key,
      Boolean(bundleHasLink.get(key) || String(row.linkContent ?? "").trim()),
    );
  });

  return rows.reduce<MissingRunningFields>((result, row) => {
    const isBundle = row.pricingType === "BUNDLE";
    const linkContent = isBundle
      ? !bundleHasLink.get(runningBundleKey(row))
      : !String(row.linkContent ?? "").trim();
    const fields = {
      planningUpload: !row.planningUpload,
      actualUpload: !row.actualUpload,
      linkContent,
    };

    if (fields.planningUpload || fields.actualUpload || fields.linkContent) {
      result[row.id] = fields;
    }

    return result;
  }, {});
}
