"use client";

import { useMemo } from "react";

import BarComparisonChart from "@/components/charts/BarComparisonChart";
import LineTrendChart from "@/components/charts/LineTrendChart";
import type { ItemRow } from "@/components/items/page";

type ItemStatsPageProps = {
  rows: ItemRow[];
  loading?: boolean;
  error?: string;
};

export default function ItemStatsPage({
  rows,
  loading = false,
  error = "",
}: ItemStatsPageProps) {

  const totalQty = useMemo(
    () => rows.reduce((sum, row) => sum + row.qty, 0),
    [rows],
  );

  const totalInventoryValue = useMemo(
    () => rows.reduce((sum, row) => sum + row.qty * row.price, 0),
    [rows],
  );

  const quantityByItem = useMemo(
    () =>
      rows.map((row) => ({
        label: row.name || `Item ${row.id}`,
        value: row.qty,
      })),
    [rows],
  );

  const inventoryValueTrend = useMemo(
    () => rows.map((row) => row.qty * row.price),
    [rows],
  );

  const inventoryValueLabels = useMemo(
    () => rows.map((row) => row.name || `#${row.id}`),
    [rows],
  );

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total Item Rows</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {loading ? "-" : rows.length}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total Inventory Value</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {loading ? "-" : totalInventoryValue.toLocaleString("id-ID")}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Total qty: {loading ? "-" : totalQty.toLocaleString("id-ID")}
          </p>
        </article>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading data statistik...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Belum ada data item untuk ditampilkan.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <BarComparisonChart
            title="Qty per Item"
            subtitle="Perbandingan jumlah stok dari tabel items"
            data={quantityByItem}
            barClassName="bg-sky-500"
          />

          <LineTrendChart
            title="Inventory Value per Item"
            subtitle="Nilai stok dihitung dari qty x price untuk tiap item"
            data={inventoryValueTrend}
            labels={inventoryValueLabels}
            strokeClassName="stroke-emerald-500"
          />
        </div>
      )}
    </section>
  );
}
