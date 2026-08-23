import { authOptions } from "@/auth";
import { getPeriodRange, projectFinancialSummary, projectGrandTotal, growthPercentage, addDays, startOfDay, type DashboardPeriod } from "@/lib/dashboard";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

const PERIODS = new Set<DashboardPeriod>(["this_month", "last_month", "last_3_months", "last_6_months", "this_year"]);
const STATUS_LABELS: Record<number, string> = { 1: "Draft", 2: "Quotation", 3: "Running", 4: "Report", 5: "Invoice" };
const amountSelect = {
  dtl_project: { select: { drf_markup_price: true, drf_qty: true, drf_creatorid: true } },
} as const;

const TRANSIENT_DATABASE_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);

function isTransientDatabaseError(error: unknown): boolean {
  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate?.code === "string" ? candidate.code : "";
  const message = typeof candidate?.message === "string" ? candidate.message.toLowerCase() : "";
  return TRANSIENT_DATABASE_CODES.has(code)
    || message.includes("can't reach database server")
    || message.includes("connection pool")
    || message.includes("timed out")
    || message.includes("connection closed");
}

async function withDatabaseRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientDatabaseError(error) || attempt === attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 350));
    }
  }
  throw lastError;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const value = new URL(request.url).searchParams.get("period") as DashboardPeriod | null;
    const period = value && PERIODS.has(value) ? value : "this_month";
    const now = new Date();
    const today = startOfDay(now);
    const inSevenDays = addDays(today, 7);
    const { start, end } = getPeriodRange(period, now);
    const currentMonth = getPeriodRange("this_month", now);
    const previousMonth = getPeriodRange("last_month", now);
    const trendStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [
      periodProjects,
      activeProjects,
      creatorsByPlatform,
      totalCreators,
      newCreators,
      completedInPeriod,
      completedCurrentMonth,
      completedPreviousMonth,
      outstandingInvoices,
      trendProjects,
      deadlineProjects,
    ] = await withDatabaseRetry(() => Promise.all([
      prisma.trs_project.findMany({
        where: { creadate: { gte: start, lt: end } },
        select: { prj_id: true, prj_status: true, prj_ienddate: true, prj_brand: true, mst_brand: { select: { brd_nama: true } }, ...amountSelect },
      }),
      prisma.trs_project.count({
        where: { creadate: { gte: start, lt: end }, OR: [{ prj_status: { in: [2, 3, 4] } }, { prj_status: 5, prj_ienddate: null }] },
      }),
      prisma.mst_creators.groupBy({ by: ["social_media"], _count: { id: true }, orderBy: { _count: { id: "desc" } } }),
      prisma.mst_creators.count(),
      prisma.mst_creators.count({ where: { created_at: { gte: currentMonth.start, lt: currentMonth.end } } }),
      prisma.trs_project.findMany({
        where: { prj_status: 5, prj_ienddate: { gte: start, lt: end } },
        select: { prj_id: true, prj_brand: true, prj_ienddate: true, prj_invoice_tax_rate: true, prj_tax_rate: true, mst_brand: { select: { brd_nama: true } }, ...amountSelect },
      }),
      prisma.trs_project.findMany({
        where: { prj_status: 5, prj_ienddate: { gte: currentMonth.start, lt: currentMonth.end } },
        select: { prj_invoice_tax_rate: true, prj_tax_rate: true, ...amountSelect },
      }),
      prisma.trs_project.findMany({
        where: { prj_status: 5, prj_ienddate: { gte: previousMonth.start, lt: previousMonth.end } },
        select: { prj_invoice_tax_rate: true, prj_tax_rate: true, ...amountSelect },
      }),
      prisma.trs_project.findMany({
        where: { prj_status: 5, prj_ienddate: null, prj_istartdate: { gte: start, lt: end } },
        select: { prj_id: true, prj_nama: true, prj_invoiceno: true, prj_istartdate: true, prj_invoice_tax_rate: true, prj_tax_rate: true, mst_brand: { select: { brd_nama: true } }, ...amountSelect },
      }),
      prisma.trs_project.findMany({
        where: { prj_status: 5, prj_ienddate: { gte: trendStart, lt: currentMonth.end } },
        select: { prj_ienddate: true, prj_invoice_tax_rate: true, prj_tax_rate: true, ...amountSelect },
      }),
      prisma.trs_project.findMany({
        where: { prj_denddate: { gte: today, lte: inSevenDays }, OR: [{ prj_status: { in: [1, 2, 3, 4] } }, { prj_status: 5, prj_ienddate: null }] },
        select: { prj_id: true, prj_nama: true, prj_status: true, prj_denddate: true, mst_brand: { select: { brd_nama: true } } },
        orderBy: { prj_denddate: "asc" }, take: 5,
      }),
    ] as const));

    const completedAmount = (project: typeof completedInPeriod[number]) =>
      projectGrandTotal(project.dtl_project, project.prj_invoice_tax_rate ?? project.prj_tax_rate);
    const revenue = completedInPeriod.reduce((sum, project) => sum + completedAmount(project), 0);
    const income = completedInPeriod.reduce((summary, project) => {
      const value = projectFinancialSummary(project.dtl_project, project.prj_invoice_tax_rate ?? project.prj_tax_rate);
      return {
        grossIncome: summary.grossIncome + value.grossIncome,
        taxDeduction: summary.taxDeduction + value.taxDeduction,
        netIncome: summary.netIncome + value.netIncome,
      };
    }, { grossIncome: 0, taxDeduction: 0, netIncome: 0 });
    const currentRevenue = completedCurrentMonth.reduce((sum, project) => sum + projectGrandTotal(project.dtl_project, project.prj_invoice_tax_rate ?? project.prj_tax_rate), 0);
    const previousRevenue = completedPreviousMonth.reduce((sum, project) => sum + projectGrandTotal(project.dtl_project, project.prj_invoice_tax_rate ?? project.prj_tax_rate), 0);

    const statusMap = new Map<string, number>();
    for (const project of periodProjects) {
      const label = project.prj_status === 5 && project.prj_ienddate ? "Finish" : STATUS_LABELS[project.prj_status] ?? "Unknown";
      statusMap.set(label, (statusMap.get(label) ?? 0) + 1);
    }
    const projectStatus = ["Draft", "Quotation", "Running", "Report", "Invoice", "Finish"].map((label) => ({ label, value: statusMap.get(label) ?? 0 }));

    const outstanding = outstandingInvoices.map((project) => ({
      ...project,
      amount: projectGrandTotal(project.dtl_project, project.prj_invoice_tax_rate ?? project.prj_tax_rate),
    }));

    const trend = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
      return { key: `${date.getFullYear()}-${date.getMonth()}`, label: date.toLocaleDateString("en-GB", { month: "short" }), value: 0 };
    });
    for (const project of trendProjects) {
      if (!project.prj_ienddate) continue;
      const key = `${project.prj_ienddate.getFullYear()}-${project.prj_ienddate.getMonth()}`;
      const bucket = trend.find((item) => item.key === key);
      if (bucket) bucket.value += projectGrandTotal(project.dtl_project, project.prj_invoice_tax_rate ?? project.prj_tax_rate);
    }

    const creatorUsage = new Map<number, Set<number>>();
    for (const project of periodProjects.filter((item) => item.prj_status >= 2)) {
      for (const detail of project.dtl_project) {
        if (!creatorUsage.has(detail.drf_creatorid)) creatorUsage.set(detail.drf_creatorid, new Set());
        creatorUsage.get(detail.drf_creatorid)!.add(project.prj_id);
      }
    }
    const topCreatorIds = [...creatorUsage.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 5).map(([id]) => id);
    const topCreatorRows = topCreatorIds.length ? await prisma.mst_creators.findMany({
      where: { id: { in: topCreatorIds } }, select: { id: true, name: true, username: true, social_media: true, photo_url: true },
    }) : [];
    const creatorLookup = new Map(topCreatorRows.map((creator) => [creator.id, creator]));

    const clientRevenue = new Map<number, { name: string; value: number }>();
    for (const project of completedInPeriod) {
      const current = clientRevenue.get(project.prj_brand) ?? { name: project.mst_brand.brd_nama ?? "-", value: 0 };
      current.value += completedAmount(project);
      clientRevenue.set(project.prj_brand, current);
    }
    const brandProjects = new Map<number, Set<number>>();
    for (const project of periodProjects.filter((item) => item.prj_status >= 2)) {
      if (!brandProjects.has(project.prj_brand)) brandProjects.set(project.prj_brand, new Set());
      brandProjects.get(project.prj_brand)!.add(project.prj_id);
    }
    const repeatClients = [...brandProjects.values()].filter((projects) => projects.size > 1).length;

    return NextResponse.json({
      period,
      overview: {
        revenue, currentMonthRevenue: currentRevenue, previousMonthRevenue: previousRevenue,
        revenueGrowth: growthPercentage(currentRevenue, previousRevenue), activeProjects, totalCreators,
        outstandingCount: outstanding.length, outstandingTotal: outstanding.reduce((sum, invoice) => sum + invoice.amount, 0),
      },
      projectStatus,
      financial: {
        revenue, outstandingTotal: outstanding.reduce((sum, invoice) => sum + invoice.amount, 0),
        completedProjects: completedInPeriod.length,
        averageProjectValue: completedInPeriod.length ? revenue / completedInPeriod.length : 0,
        ...income,
      },
      revenueTrend: trend.map(({ label, value }) => ({ label, value })),
      creatorStats: {
        byPlatform: creatorsByPlatform.map((row) => ({ label: row.social_media, value: row._count.id })),
        newThisMonth: newCreators,
        top: topCreatorIds.map((id) => ({ ...creatorLookup.get(id), projects: creatorUsage.get(id)?.size ?? 0 })).filter((item) => item.name),
      },
      alerts: {
        deadlines: deadlineProjects.map((project) => ({
          id: project.prj_id, name: project.prj_nama, brand: project.mst_brand.brd_nama ?? "-",
          status: STATUS_LABELS[project.prj_status] ?? "Unknown", deadline: project.prj_denddate,
          daysLeft: Math.max(0, Math.ceil((project.prj_denddate.getTime() - today.getTime()) / 86_400_000)),
        })),
        invoices: [],
      },
      clientAnalytics: {
          top: [...clientRevenue.values()]
            .sort((a, b) => b.value - a.value)
            .slice(0, 5)
            .map((client) => ({ label: client.name, value: client.value })),
        repeatRate: brandProjects.size ? (repeatClients / brandProjects.size) * 100 : 0,
        repeatClients, totalClients: brandProjects.size,
      },
      notes: { invoiceDueDateAvailable: false, cancelledStatusAvailable: false, paymentStatusAvailable: false },
    });
  } catch (error) {
    console.error("DASHBOARD ERROR:", error);
    const temporarilyUnavailable = isTransientDatabaseError(error);
    return NextResponse.json(
      {
        error: temporarilyUnavailable
          ? "The database is temporarily unavailable. Please try again."
          : "Failed to load dashboard data",
      },
      {
        status: temporarilyUnavailable ? 503 : 500,
        headers: temporarilyUnavailable ? { "Retry-After": "2" } : undefined,
      },
    );
  }
}
