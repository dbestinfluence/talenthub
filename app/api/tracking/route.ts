import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { isGoogleSheetsConfigured, syncProjectSpreadsheet } from "@/lib/google-sheets";
import { normalizeProjectNumber } from "@/lib/project-numbers";

const TRANSIENT_DATABASE_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);

function isTransientDatabaseError(error: unknown) {
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

async function authorize() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  return session;
}

async function generateProjectCode() {
  const now = new Date();

  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  const prefix = `TRS-${yy}${mm}${dd}`;

  const lastProject = await prisma.trs_project.findFirst({
    where: {
      prj_kode: {
        startsWith: prefix,
      },
    },
    orderBy: {
      prj_kode: "desc",
    },
    select: {
      prj_kode: true,
    },
  });

  let running = 1;

  if (lastProject?.prj_kode) {
    const parts = lastProject.prj_kode.split("-");
    running = Number(parts[2]) + 1;
  }

  return `${prefix}-${String(running).padStart(4, "0")}`;
}

function getProjectStatus(status: number | null) {
  switch (status) {
    case 1:
      return "Draft";
    case 2:
      return "Quotation";
    case 3:
      return "Running";
    case 4:
      return "Report";
    case 5:
      return "Invoice";
    case 6:
      return "Finish";
    default:
      return "-";
  }
}

// ================= GET =================
export async function GET(request: Request) {
  const session = await authorize();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

// ================= GET DETAIL =================
if (id) {
  const project = await withDatabaseRetry(() =>
    prisma.trs_project.findUnique({
      where: { prj_id: Number(id) },
      include: { mst_brand: true, mst_payment: true, mst_dbest: true },
    })
  );

  if (!project) {
    return NextResponse.json(
      {
        error: "Project was not found",
      },
      {
        status: 404,
      }
    );
  }

  const transactionNo = normalizeProjectNumber("TRS", project.prj_kode) || project.prj_kode;
  const quotationNo = project.prj_status >= 2
    ? normalizeProjectNumber("QUO", project.prj_quotationno, transactionNo)
    : "";
  const invoiceNo = project.prj_status >= 5
    ? normalizeProjectNumber("INV", project.prj_invoiceno, transactionNo)
    : "";

  const repairedNumbers = {
    ...(project.prj_kode !== transactionNo ? { prj_kode: transactionNo } : {}),
    ...(project.prj_status >= 2 && project.prj_quotationno !== quotationNo
      ? { prj_quotationno: quotationNo }
      : {}),
    ...(project.prj_status >= 5 && project.prj_invoiceno !== invoiceNo
      ? { prj_invoiceno: invoiceNo }
      : {}),
  };
  if (Object.keys(repairedNumbers).length > 0) {
    await prisma.trs_project.update({
      where: { prj_id: project.prj_id },
      data: repairedNumbers,
    }).catch((error) => console.error("PROJECT NUMBER BACKFILL ERROR:", error));
  }

  return NextResponse.json({
    id: project.prj_id,
    code: transactionNo,

    brandId: project.prj_brand,
    brand: project.mst_brand?.brd_nama ?? "",
    brandContact: project.mst_brand?.brd_notelp ?? "",
    brandEmail: project.mst_brand?.brd_email ?? "",
    brandAddress: project.mst_brand?.brd_alamat ?? "",
    brandPic: project.mst_brand?.brd_pic1 ?? "",

    name: project.prj_nama,

    quotationNo,
    invoiceNo,
    taxRate: Number(project.prj_tax_rate),
    invoiceTaxRate: Number(project.prj_invoice_tax_rate ?? project.prj_tax_rate),
    payment: project.mst_payment
      ? {
          bank: project.mst_payment.pyt_bank,
          accountNo: project.mst_payment.pyt_norek,
          accountName: project.mst_payment.pyt_nama,
        }
      : null,
    dbest: project.mst_dbest
      ? { name: project.mst_dbest.bst_nama ?? "", address: project.mst_dbest.bst_alamat ?? "" }
      : null,

    draftStartDate: project.prj_dstartdate,
    draftEndDate: project.prj_denddate,

    quotationStartDate: project.prj_qstartdate,
    quotationEndDate: project.prj_qenddate,

    runningStartDate: project.prj_rstartdate,
    runningEndDate: project.prj_renddate,
    reportStartDate: project.prj_renddate,

    invoiceStartDate: project.prj_istartdate,
    invoiceEndDate: project.prj_ienddate,
    finishDate: project.prj_ienddate,
    status: getProjectStatus(project.prj_status),
    statusId: project.prj_status,

    createdBy: project.creaby,
    createdAt: project.creadate,

    modifiedBy: project.modiby,
    modifiedAt: project.modidate,
    spreadsheetUrl: project.prj_sheeturl,
    spreadsheetSyncedAt: project.prj_sheet_sync,
  });
}

    // ================= GET ALL =================
    const [projects, brands] = await withDatabaseRetry(() => Promise.all([
      prisma.trs_project.findMany({
        include: {
          mst_brand: true,
        },
        orderBy: {
          prj_id: "desc",
        },
      }),

      prisma.mst_brand.findMany({
        where: {
          brd_status: 1,
        },
        orderBy: {
          brd_nama: "asc",
        },
      }),
    ]));

const result = projects.map((item) => ({
  id: item.prj_id,
  // Progress cards use a project-facing PRJ code. The official transaction
  // number remains TRS and is returned by the detail endpoint for documents.
  code: normalizeProjectNumber("PRJ", item.prj_kode) || item.prj_kode,
  name: item.prj_nama,
  brandId: item.prj_brand,
  brand: item.mst_brand?.brd_nama ?? "",
  date: item.creadate,
  projectDate: item.prj_dstartdate,
  status: getProjectStatus(item.prj_status),
  statusId: item.prj_status,
}));

    return NextResponse.json({
      projects: result,
      brands: brands.map((item) => ({
        id: item.brd_id,
        name: item.brd_nama,
      })),
    });
  } catch (error) {
    console.error("GET TRACKING ERROR:", error);

    const temporarilyUnavailable = isTransientDatabaseError(error);
    return NextResponse.json(
      { error: temporarilyUnavailable ? "The database is temporarily unavailable. Please try again." : "Failed to fetch project data" },
      { status: temporarilyUnavailable ? 503 : 500, headers: temporarilyUnavailable ? { "Retry-After": "2" } : undefined }
    );
  }
}

// ================= POST =================
export async function POST(request: Request) {
  const session = await authorize();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
const body = await request.json();

const projectCode = await generateProjectCode();

const activeDbest = await prisma.mst_dbest.findFirst({ where: { bst_status: 1 }, orderBy: { bst_id: "desc" }, select: { bst_id: true } });
if (!activeDbest) return NextResponse.json({ error: "Configure an active DBest identity in Master Data before creating a project." }, { status: 400 });

const project = await prisma.trs_project.create({
  data: {
    prj_kode: projectCode,

    prj_brand: Number(body.prj_brand),
    prj_dbestid: activeDbest.bst_id,
    prj_nama: body.prj_nama,
    prj_quotationno: null,
    prj_invoiceno: null,

    prj_dstartdate: new Date(body.prj_dstartdate),

    prj_denddate: new Date(body.prj_denddate),

    prj_qstartdate: body.prj_qstartdate
      ? new Date(body.prj_qstartdate)
      : null,
    prj_qenddate: body.prj_qenddate
      ? new Date(body.prj_qenddate)
      : null,

    prj_rstartdate: body.prj_rstartdate
      ? new Date(body.prj_rstartdate)
      : null,
    prj_renddate: body.prj_renddate
      ? new Date(body.prj_renddate)
      : null,

    prj_istartdate: body.prj_istartdate
      ? new Date(body.prj_istartdate)
      : null,
    prj_ienddate: body.prj_ienddate
      ? new Date(body.prj_ienddate)
      : null,

    prj_status: body.prj_status || 1,

    creaby: session.user.name ?? "admin",
    creadate: new Date(),
    modidate: new Date(),
  },
});

if (isGoogleSheetsConfigured()) {
  await syncProjectSpreadsheet(project.prj_id).catch((error) =>
    console.error("AUTO CREATE GOOGLE SHEET ERROR:", error)
  );
}

    return NextResponse.json({
      message: "Project has been created",
      data: project,
    });
  } catch (error) {
    console.error("POST TRACKING ERROR:", error);

    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}

// ================= PUT =================
export async function PUT(request: Request) {
  const session = await authorize();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid ID" },
        { status: 400 }
      );
    }

    const body = await request.json();

    const isGeneratingInvoice = Number(body.prj_status) === 5;
    let selectedPaymentId: number | null = null;
    let generatedInvoiceNo: string | null = null;
    let initialInvoiceTaxRate: number | null = null;
    if (isGeneratingInvoice) {
      const currentProject = await prisma.trs_project.findUnique({
        where: { prj_id: id },
        select: {
          prj_status: true,
          prj_kode: true,
          prj_invoiceno: true,
          prj_tax_rate: true,
          prj_invoice_tax_rate: true,
        },
      });

      if (!currentProject) {
        return NextResponse.json({ error: "Project was not found" }, { status: 404 });
      }

      if ((currentProject.prj_status ?? 0) >= 5) {
        return NextResponse.json(
          { error: "An invoice has already been created for this project" },
          { status: 409 }
        );
      }

      const paymentId = Number(body.prj_paymentid);
      if (!Number.isInteger(paymentId) || paymentId <= 0) {
        return NextResponse.json(
          { error: "Select a payment account before generating the invoice" },
          { status: 400 }
        );
      }

      const payment = await prisma.mst_payment.findFirst({
        where: {
          pyt_id: paymentId,
          pyt_status: { in: [1, 2] },
        },
        select: { pyt_id: true },
      });

      if (!payment) {
        return NextResponse.json(
          { error: "The selected payment account is unavailable" },
          { status: 400 }
        );
      }

      selectedPaymentId = payment.pyt_id;
      const transactionNo = normalizeProjectNumber("TRS", currentProject.prj_kode) || currentProject.prj_kode;
      generatedInvoiceNo = normalizeProjectNumber("INV", currentProject.prj_invoiceno, transactionNo);
      initialInvoiceTaxRate = Number(
        currentProject.prj_invoice_tax_rate ?? currentProject.prj_tax_rate,
      );
    }

    if (Number(body.prj_status) === 4) {
      const runningDetails = await prisma.dtl_project.findMany({
        where: { drf_projectid: id },
        select: {
          drf_id: true,
          drf_planning_upload: true,
          drf_actual_upload: true,
          drf_link_content: true,
        },
      });

      const missingRunningFields = runningDetails.reduce<Record<number, {
        planningUpload: boolean;
        actualUpload: boolean;
        linkContent: boolean;
      }>>((result, detail) => {
        const fields = {
          planningUpload: !detail.drf_planning_upload,
          actualUpload: !detail.drf_actual_upload,
          linkContent: !detail.drf_link_content?.trim(),
        };

        if (fields.planningUpload || fields.actualUpload || fields.linkContent) {
          result[detail.drf_id] = fields;
        }

        return result;
      }, {});

      if (Object.keys(missingRunningFields).length > 0) {
        return NextResponse.json(
          {
            error: "Complete all Running data before generating the report",
            missingRunningFields,
          },
          { status: 400 }
        );
      }
    }

    if (Number(body.prj_status) === 2) {
      const draftDetails = await prisma.dtl_project.findMany({
        where: {
          drf_projectid: id,
        },
        select: {
          drf_id: true,
          drf_sow: true,
          drf_rate: true,
          drf_markup_price: true,
          drf_qty: true,
        },
      });

      const detailsWithoutSow = draftDetails.filter((detail) => !detail.drf_sow);
      const missingPricingFields = draftDetails.reduce<Record<number, {
        rateCard: boolean;
        markupPrice: boolean;
        qty: boolean;
      }>>((result, detail) => {
        const fields = {
          rateCard: Number(detail.drf_rate ?? 0) <= 0,
          markupPrice: Number(detail.drf_markup_price ?? 0) <= 0,
          qty: detail.drf_qty === null || !Number.isInteger(detail.drf_qty) || detail.drf_qty <= 0,
        };
        if (fields.rateCard || fields.markupPrice || fields.qty) result[detail.drf_id] = fields;
        return result;
      }, {});

      if (detailsWithoutSow.length > 0 || Object.keys(missingPricingFields).length > 0) {
        return NextResponse.json(
          {
            error: "Complete the SOW, Rate Card, Mark Price, and Qty for every creator before generating the quotation",
            missingSowCreatorIds: detailsWithoutSow.map((detail) => detail.drf_id),
            missingPricingFields,
          },
          { status: 400 }
        );
      }
    }

    const updateData: any = {
      modiby: session.user.name ?? "admin",
      modidate: new Date(),
    };

    if (selectedPaymentId) {
      updateData.prj_paymentid = selectedPaymentId;
    }
    if (generatedInvoiceNo) {
      updateData.prj_invoiceno = generatedInvoiceNo;
    }
    if (initialInvoiceTaxRate !== null) {
      updateData.prj_invoice_tax_rate = initialInvoiceTaxRate;
    }

    // ================= Data Project =================
    if (body.prj_brand !== undefined)
      updateData.prj_brand = Number(body.prj_brand);

    if (body.prj_nama !== undefined)
      updateData.prj_nama = body.prj_nama;

    if (body.prj_quotationno !== undefined)
      updateData.prj_quotationno = body.prj_quotationno;

    if (body.prj_invoiceno !== undefined)
      updateData.prj_invoiceno = body.prj_invoiceno;

    if (body.prj_tax_rate !== undefined) {
      const taxRate = Number(body.prj_tax_rate);
      if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100)
        return NextResponse.json({ error: "Tax rate must be between 0 and 100" }, { status: 400 });
      updateData.prj_tax_rate = taxRate;
    }

    if (body.prj_invoice_tax_rate !== undefined) {
      const invoiceTaxRate = Number(body.prj_invoice_tax_rate);
      if (!Number.isFinite(invoiceTaxRate) || invoiceTaxRate < 0 || invoiceTaxRate > 100)
        return NextResponse.json({ error: "Invoice tax rate must be between 0 and 100" }, { status: 400 });
      updateData.prj_invoice_tax_rate = invoiceTaxRate;
    }

    if (body.prj_dstartdate)
      updateData.prj_dstartdate = new Date(body.prj_dstartdate);

    if (body.prj_denddate)
      updateData.prj_denddate = new Date(body.prj_denddate);

    if (body.prj_qstartdate)
      updateData.prj_qstartdate = new Date(body.prj_qstartdate);

    if (body.prj_qenddate)
      updateData.prj_qenddate = new Date(body.prj_qenddate);

    if (body.prj_rstartdate)
      updateData.prj_rstartdate = new Date(body.prj_rstartdate);

    if (body.prj_renddate)
      updateData.prj_renddate = new Date(body.prj_renddate);

    if (body.prj_istartdate)
      updateData.prj_istartdate = new Date(body.prj_istartdate);

    if (body.prj_ienddate)
      updateData.prj_ienddate = new Date(body.prj_ienddate);

    // ================= Status =================
    if (body.prj_status !== undefined) {
      const requestedStatus = Number(body.prj_status);

      if (requestedStatus === 2) {
        const currentProject = await prisma.trs_project.findUnique({
          where: { prj_id: id },
          select: { prj_kode: true, prj_quotationno: true },
        });
        if (!currentProject) {
          return NextResponse.json({ error: "Project was not found" }, { status: 404 });
        }
        const transactionNo = normalizeProjectNumber("TRS", currentProject.prj_kode) || currentProject.prj_kode;
        updateData.prj_kode = transactionNo;
        updateData.prj_quotationno = normalizeProjectNumber("QUO", currentProject.prj_quotationno, transactionNo);
      }

      // Finish hanya menandai akhir invoice; status utama tetap Invoice.
      if (requestedStatus !== 6) {
        updateData.prj_status = requestedStatus;
      }

      // otomatis isi tanggal mulai setiap status
      switch (requestedStatus) {
        case 2:
          updateData.prj_qstartdate = new Date();
          break;

        case 3:
          updateData.prj_rstartdate = new Date();
          break;

        case 4:
          updateData.prj_renddate = new Date();
          break;

        case 5:
          updateData.prj_istartdate = new Date();
          break;

        case 6:
          updateData.prj_ienddate = new Date();
          break;
      }
    }

    const project = await prisma.trs_project.update({
      where: {
        prj_id: id,
      },
      data: updateData,
    });

    return NextResponse.json({
      message: isGeneratingInvoice ? "Invoice has been generated" : "Project has been updated",
      data: project,
    });
  } catch (error) {
    console.error("PUT TRACKING ERROR:", error);

    return NextResponse.json(
      {
        error: "Failed to update project",
      },
      {
        status: 500,
      }
    );
  }
}

// ================= DELETE =================
export async function DELETE(request: Request) {
  const session = await authorize();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid ID" },
        { status: 400 }
      );
    }

  const project = await prisma.trs_project.delete({
    where: {
      prj_id: id,
    },
  });

  return NextResponse.json({
    message: "Project has been deleted",
    data: project,
  });
  } catch (error) {
    console.error("DELETE TRACKING ERROR:", error);

    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
