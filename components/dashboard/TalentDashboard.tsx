"use client";

import { Children, useEffect, useState, type ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Metric = { label: string; value: number };
type DashboardData = {
  overview: { revenue: number; currentMonthRevenue: number; previousMonthRevenue: number; revenueGrowth: number | null; activeProjects: number; totalCreators: number; outstandingCount: number; outstandingTotal: number };
  projectStatus: Metric[];
  financial: { revenue: number; outstandingTotal: number; completedProjects: number; averageProjectValue: number; grossIncome: number; taxDeduction: number; netIncome: number };
  revenueTrend: Metric[];
  creatorStats: { byPlatform: Metric[]; newThisMonth: number; top: Array<{ id: number; name: string; username: string; social_media: string; photo_url: string | null; projects: number }> };
  alerts: { deadlines: Array<{ id: number; name: string; brand: string; status: string; deadline: string; daysLeft: number }>; invoices: Array<{ id: number; invoiceNo: string; project: string; brand: string; amount: number; dueDate: string; daysLeft: number }> };
  clientAnalytics: { top: Metric[]; repeatRate: number; repeatClients: number; totalClients: number };
};

const periods = [
  ["this_month", "This Month"], ["last_month", "Last Month"], ["last_3_months", "Last 3 Months"],
  ["last_6_months", "Last 6 Months"], ["this_year", "This Year"],
] as const;
const colors = ["#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e", "#64748b"];
const currency = (value: number) => `Rp${Math.round(value).toLocaleString("id-ID")}`;
const number = (value: number) => Math.round(value).toLocaleString("id-ID");
const date = (value: string) => new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const compactCurrency = (value: number) => value >= 1_000_000_000 ? `Rp ${(value / 1_000_000_000).toFixed(1)}B` : value >= 1_000_000 ? `Rp ${Math.round(value / 1_000_000)}M` : currency(value);
const profilePhotoSource = (value: string | null) => {
  const url = String(value ?? "").trim();
  if (!url) return "/image/default-kol-avatar.png";
  if (url.startsWith("/") || url.startsWith("data:image/")) return url;
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
};

const emptyDashboardData: DashboardData = {
  overview: { revenue: 0, currentMonthRevenue: 0, previousMonthRevenue: 0, revenueGrowth: null, activeProjects: 0, totalCreators: 0, outstandingCount: 0, outstandingTotal: 0 },
  projectStatus: ["Draft", "Quotation", "Running", "Report", "Invoice", "Finish"].map((label) => ({ label, value: 0 })),
  financial: { revenue: 0, outstandingTotal: 0, completedProjects: 0, averageProjectValue: 0, grossIncome: 0, taxDeduction: 0, netIncome: 0 },
  revenueTrend: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((label) => ({ label, value: 0 })),
  creatorStats: { byPlatform: [], newThisMonth: 0, top: [] },
  alerts: { deadlines: [], invoices: [] },
  clientAnalytics: { top: [], repeatRate: 0, repeatClients: 0, totalClients: 0 },
};

export default function TalentDashboard() {
  const [period, setPeriod] = useState("this_month");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);
  const [activeTab, setActiveTab] = useState<"financial" | "projects">("financial");

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const response = await fetch(`/api/dashboard?period=${period}`, {
            signal: controller.signal,
            cache: "no-store",
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result.error ?? "Failed to load dashboard data");
          if (!controller.signal.aborted) setData(result);
          return;
        } catch (reason) {
          if (reason instanceof DOMException && reason.name === "AbortError") return;
          lastError = reason instanceof Error ? reason : new Error("Failed to load dashboard data");
          if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 700));
        }
      }

      if (!controller.signal.aborted) {
        setError(lastError?.message ?? "Failed to load dashboard data");
        setData((current) => current ?? emptyDashboardData);
      }
    };

    void load().finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [period, requestVersion]);

  const changePeriod = (value: string) => {
    setLoading(true);
    setError("");
    setPeriod(value);
  };

  if (loading && !data) return <DashboardSkeleton />;
  if (!data) return null;

  const growth = data.overview.revenueGrowth;
  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Executive Dashboard</p><h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Talent Hub Performance Overview</h1><p className="mt-2 text-sm text-slate-600">A consolidated view of campaign operations, creator performance, and financial health.</p></div>
          <label className="flex w-full flex-col gap-2 text-sm font-semibold text-slate-700 sm:w-auto sm:flex-row sm:items-center">Period<select value={period} disabled={loading} onChange={(event) => changePeriod(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium outline-none focus:border-sky-500 disabled:cursor-wait disabled:opacity-60 sm:w-auto">{periods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
      </div>

      {error ? <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between"><span>Dashboard data is temporarily unavailable. Empty or previously loaded data is shown. {error}</span><button type="button" onClick={() => setRequestVersion((value) => value + 1)} className="shrink-0 rounded-lg bg-amber-900 px-4 py-2 text-xs font-semibold text-white">Try Again</button></div> : null}

      <div className="inline-flex w-full rounded-2xl border border-slate-200 bg-white p-1 shadow-sm sm:w-auto" role="tablist" aria-label="Dashboard sections">
        <button type="button" role="tab" aria-selected={activeTab === "financial"} onClick={() => setActiveTab("financial")} className={`flex-1 rounded-xl px-5 py-2.5 text-sm font-semibold sm:flex-none ${activeTab === "financial" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>Financial Overview</button>
        <button type="button" role="tab" aria-selected={activeTab === "projects"} onClick={() => setActiveTab("projects")} className={`flex-1 rounded-xl px-5 py-2.5 text-sm font-semibold sm:flex-none ${activeTab === "projects" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>Project Monitoring</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {activeTab === "financial" ? <>
          <SummaryCard title="Gross Income" value={currency(data.financial.grossIncome)} detail="Subtotal of Mark Price × Qty" tone="sky" />
          <SummaryCard title="Net Income After Tax" value={currency(data.financial.netIncome)} detail={`${currency(data.financial.taxDeduction)} total tax deduction`} tone="emerald" />
          <SummaryCard title="Recognized Revenue" value={currency(data.overview.revenue)} detail={growth === null ? "No prior-month revenue for comparison" : `${growth >= 0 ? "Up" : "Down"} ${Math.abs(growth).toLocaleString("en-US", { maximumFractionDigits: 1 })}% from the previous month`} tone={growth !== null && growth < 0 ? "rose" : "emerald"} />
          <SummaryCard title="Open Invoices" value={`${number(data.overview.outstandingCount)} Invoice${data.overview.outstandingCount === 1 ? "" : "s"}`} detail={`${currency(data.overview.outstandingTotal)} in open invoice value`} tone="amber" />
        </> : <>
          <SummaryCard title="Active Projects" value={number(data.overview.activeProjects)} detail="Quotation through active Invoice stages" tone="sky" />
          <SummaryCard title="Active Creators" value={number(data.overview.totalCreators)} detail={`+${number(data.creatorStats.newThisMonth)} creators added this month`} tone="violet" />
          <SummaryCard title="Completed Projects" value={number(data.financial.completedProjects)} detail="Finished in the selected period" tone="emerald" />
          <SummaryCard title="Upcoming Deadlines" value={number(data.alerts.deadlines.length)} detail="Due within the next seven days" tone="amber" />
        </>}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className={activeTab === "projects" ? "block xl:col-span-2" : "hidden"}><ChartCard title="Project Pipeline" subtitle="Project distribution by workflow stage for the selected period">
          <ResponsiveContainer width="100%" height={280}><BarChart data={data.projectStatus} margin={{ left: 0, right: 12 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="label" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} tick={{ fontSize: 12 }} /><Tooltip formatter={(value) => [number(Number(value)), "Project"]} /><Bar dataKey="value" radius={[8, 8, 0, 0]}>{data.projectStatus.map((item, index) => <Cell key={item.label} fill={colors[index % colors.length]} />)}</Bar></BarChart></ResponsiveContainer>
        </ChartCard></div>
        <div className={activeTab === "financial" ? "block xl:col-span-2" : "hidden"}><Card title="Financial Overview" subtitle="Financial values calculated from unique projects">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><SmallMetric label="Gross Income" value={currency(data.financial.grossIncome)} /><SmallMetric label="Tax Deduction" value={currency(data.financial.taxDeduction)} /><SmallMetric label="Net Income" value={currency(data.financial.netIncome)} /><SmallMetric label="Average Completed Project Value" value={currency(data.financial.averageProjectValue)} /></div>
        </Card></div>
      </div>

      <div className={activeTab === "financial" ? "block" : "hidden"}><ChartCard title="Revenue Performance" subtitle="Completed-project revenue across the trailing 12 months">
        <ResponsiveContainer width="100%" height={320}><AreaChart data={data.revenueTrend} margin={{ left: 8, right: 16 }}><defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} /><stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="label" tick={{ fontSize: 12 }} /><YAxis tickFormatter={compactCurrency} tick={{ fontSize: 11 }} width={75} /><Tooltip formatter={(value) => [currency(Number(value)), "Revenue"]} /><Area type="monotone" dataKey="value" stroke="#0284c7" strokeWidth={3} fill="url(#revenueFill)" /></AreaChart></ResponsiveContainer>
      </ChartCard></div>

      <div className={`grid gap-6 xl:grid-cols-2 ${activeTab === "projects" ? "grid" : "hidden"}`}>
        <ChartCard title="Creator Portfolio by Platform" subtitle="Unique creator accounts grouped by their database platform">
          {data.creatorStats.byPlatform.length ? <ResponsiveContainer width="100%" height={280}><PieChart><Pie data={data.creatorStats.byPlatform} dataKey="value" nameKey="label" innerRadius={62} outerRadius={100} paddingAngle={3}>{data.creatorStats.byPlatform.map((item, index) => <Cell key={item.label} fill={colors[index % colors.length]} />)}</Pie><Tooltip formatter={(value) => [number(Number(value)), "Creators"]} /></PieChart></ResponsiveContainer> : <EmptyState text="No creator records are available." />}
          <div className="flex flex-wrap justify-center gap-4">{data.creatorStats.byPlatform.map((item, index) => <span key={item.label} className="inline-flex items-center gap-2 text-xs text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />{item.label}: {number(item.value)}</span>)}</div>
        </ChartCard>
        <Card title="Most Engaged Creators" subtitle="Creators with the highest number of unique project engagements">
          <RankList empty="No creator engagement data is available for this period.">{data.creatorStats.top.map((creator, index) => <div key={creator.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"><span className="w-6 text-sm font-bold text-slate-400">{index + 1}</span><img src={profilePhotoSource(creator.photo_url)} onError={(event) => { event.currentTarget.src = "/image/default-kol-avatar.png"; }} alt="" className="h-10 w-10 rounded-full bg-slate-100 object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{creator.name}</p><p className="truncate text-xs text-slate-500">@{creator.username.replace(/^@+/, "")} · {creator.social_media}</p></div><span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">{creator.projects} Project{creator.projects === 1 ? "" : "s"}</span></div>)}</RankList>
        </Card>
      </div>

      <div className="grid items-stretch gap-6 xl:grid-cols-2">
        <div className={activeTab === "projects" ? "block xl:col-span-2" : "hidden"}>
        <Card title="Upcoming Project Deadlines" subtitle="Active projects with deadlines in the next seven days">
          <RankList empty="No project deadlines fall within the next seven days.">{data.alerts.deadlines.map((item) => <div key={item.id} className={`rounded-xl border p-4 ${item.daysLeft <= 1 ? "border-rose-200 bg-rose-50" : item.daysLeft <= 3 ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="truncate font-semibold text-slate-900">{item.name}</p><p className="mt-1 text-xs font-medium text-slate-600">{item.brand} · {item.status}</p><p className="mt-3 text-xs text-slate-500">Deadline: <strong className="text-slate-700">{date(item.deadline)}</strong></p></div><span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${item.daysLeft <= 1 ? "bg-rose-100 text-rose-700" : item.daysLeft <= 3 ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-700"}`}>{item.daysLeft === 0 ? "Due Today" : `${item.daysLeft} day${item.daysLeft === 1 ? "" : "s"} remaining`}</span></div></div>)}</RankList>
        </Card></div>
        <div className={activeTab === "financial" ? "block xl:col-span-2" : "hidden"}>
        <Card title="Highest-Value Clients" subtitle="Top brands ranked by completed-project revenue">
          <RankList empty="No completed-project revenue is available for this period.">{data.clientAnalytics.top.map((client, index) => <div key={`${client.label}-${index}`} className="flex items-center justify-between gap-4 rounded-xl border border-sky-100 bg-sky-50/60 p-4"><div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">{index + 1}</span><div className="min-w-0"><p className="truncate font-semibold text-slate-900">{client.label}</p><p className="mt-1 text-xs text-slate-500">Completed-project revenue</p></div></div><div className="shrink-0 text-right"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Revenue</p><p className="mt-1 text-sm font-bold text-slate-900 sm:text-base">{currency(client.value)}</p></div></div>)}</RankList>
          {data.clientAnalytics.top.length ? <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">Showing {data.clientAnalytics.top.length} highest-value brand{data.clientAnalytics.top.length === 1 ? "" : "s"} with completed projects in the selected period.</p> : null}
        </Card></div>
      </div>
    </section>
  );
}

function SummaryCard({ title, value, detail, tone }: { title: string; value: string; detail: string; tone: "sky" | "emerald" | "amber" | "rose" | "violet" }) { const tones = { sky: "bg-sky-50 text-sky-700", emerald: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", rose: "bg-rose-50 text-rose-700", violet: "bg-violet-50 text-violet-700" }; return <article className="flex min-h-44 min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">{title}</p><p className="mt-3 break-words text-2xl font-bold text-slate-900">{value}</p><p className={`mt-auto w-fit max-w-full rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>{detail}</p></article>; }
function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p><div className="mt-5">{children}</div></article>; }
function ChartCard(props: { title: string; subtitle: string; children: React.ReactNode }) { return <Card {...props}>{props.children}</Card>; }
function SmallMetric({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) { return <div className={`rounded-xl border p-4 ${warning ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50"}`}><p className="text-xs font-medium text-slate-500">{label}</p><p className={`mt-2 break-words text-lg font-bold ${warning ? "text-rose-700" : "text-slate-900"}`}>{value}</p></div>; }
function RankList({ children, empty }: { children: ReactNode; empty: string }) {
  const items = Children.toArray(children);
  return <div className="space-y-3">{items.length ? items : <EmptyState text={empty} />}</div>;
}
function EmptyState({ text }: { text: string }) { return <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">{text}</div>; }
function DashboardSkeleton() { return <section className="space-y-6" aria-label="Loading dashboard"><div className="h-36 animate-pulse rounded-3xl bg-white/80" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-40 animate-pulse rounded-2xl bg-white/80" />)}</div><div className="grid gap-6 xl:grid-cols-2"><div className="h-80 animate-pulse rounded-2xl bg-white/80" /><div className="h-80 animate-pulse rounded-2xl bg-white/80" /></div></section>; }
