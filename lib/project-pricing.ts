export type ProjectPricingDetail = {
  drf_pricing_type?: string | null;
  drf_bundle_id?: string | null;
  drf_bundle_price?: unknown;
  drf_markup_price?: unknown;
  drf_qty?: number | null;
};

export function calculateProjectSubtotal(details: ProjectPricingDetail[]) {
  const countedBundleIds = new Set<string>();

  return details.reduce((sum, detail) => {
    if (detail.drf_pricing_type === "BUNDLE" && detail.drf_bundle_id) {
      if (countedBundleIds.has(detail.drf_bundle_id)) return sum;
      countedBundleIds.add(detail.drf_bundle_id);
      return sum + Number(detail.drf_bundle_price ?? 0);
    }

    return sum + Number(detail.drf_markup_price ?? 0) * Number(detail.drf_qty ?? 0);
  }, 0);
}
