import { ChangeEvent, ReactNode, useEffect, useRef, useState } from "react";
import FileDocumentIcon from "@/components/icons/FileDocumentIcon";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { loadCompanyLogo } from "@/lib/pdf-branding";

import CreatorTable from "./CreatorTable";
import { showAlertValidationError, showSuccess } from "@/lib/alert";
import { calculateTaxSummary } from "@/lib/tax";

type Props = {
  creators: any[];
  projectDetail: any;

  handleSort: (field: string) => void;
  getSortIcon: (field: string) => ReactNode;

  handleStartProject: (taxRate: number) => void;
  readOnly?: boolean;
  showView?: boolean;
  onView?: (creator: any) => void;
};

export default function QuotationSection({
  creators,
  projectDetail,
  handleSort,
  getSortIcon,
  handleStartProject,
  showView,
  onView,
  readOnly = false,
}: Props) {
  const [sending, setSending] = useState(false);
  const [uploadedPdf, setUploadedPdf] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const initialTaxRate = Number(projectDetail?.taxRate ?? 11);
  const [taxRateInput, setTaxRateInput] = useState(() => String(initialTaxRate));
  const [savedTaxRate, setSavedTaxRate] = useState(initialTaxRate);
  const [savingTaxRate, setSavingTaxRate] = useState(false);
  const [quotationNoInput, setQuotationNoInput] = useState(() => String(projectDetail?.quotationNo ?? ""));
  const [savedQuotationNo, setSavedQuotationNo] = useState(() => String(projectDetail?.quotationNo ?? ""));
  const [savingQuotationNo, setSavingQuotationNo] = useState(false);
  const taxRate = Number(taxRateInput);
  const taxRateIsValid = taxRateInput.trim() !== "" && Number.isFinite(taxRate) && taxRate >= 0 && taxRate <= 100;
  const taxSummary = calculateTaxSummary(Number(projectDetail?.subtotal ?? 0), taxRate);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    const nextTaxRate = Number(projectDetail?.taxRate ?? 11);
    setTaxRateInput(String(nextTaxRate));
    setSavedTaxRate(nextTaxRate);
  }, [projectDetail?.id, projectDetail?.taxRate]);

  useEffect(() => {
    const nextQuotationNo = String(projectDetail?.quotationNo ?? "");
    setQuotationNoInput(nextQuotationNo);
    setSavedQuotationNo(nextQuotationNo);
  }, [projectDetail?.id, projectDetail?.quotationNo]);

  const saveQuotationNo = async () => {
    if (savingQuotationNo) return;
    const nextQuotationNo = quotationNoInput.trim();
    if (!nextQuotationNo) {
      await showAlertValidationError("Quotation No is required.");
      setQuotationNoInput(savedQuotationNo);
      return;
    }
    if (nextQuotationNo === savedQuotationNo) return;

    setSavingQuotationNo(true);
    try {
      const response = await fetch(`/api/tracking?id=${projectDetail?.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prj_quotationno: nextQuotationNo }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Failed to update Quotation No.");
      setQuotationNoInput(nextQuotationNo);
      setSavedQuotationNo(nextQuotationNo);
      await showSuccess("Quotation No updated", `Quotation No has been saved as ${nextQuotationNo}.`);
    } catch (error) {
      setQuotationNoInput(savedQuotationNo);
      await showAlertValidationError(error instanceof Error ? error.message : "Failed to update Quotation No.");
    } finally {
      setSavingQuotationNo(false);
    }
  };

  const saveTaxRate = async () => {
    if (readOnly || savingTaxRate) return false;

    if (!taxRateIsValid) {
      await showAlertValidationError("PPN must be a number between 0 and 100.");
      setTaxRateInput(String(savedTaxRate));
      return false;
    }

    if (taxRate === savedTaxRate) return true;

    const projectId = Number(projectDetail?.id);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      await showAlertValidationError("Project data was not found.");
      setTaxRateInput(String(savedTaxRate));
      return false;
    }

    setSavingTaxRate(true);
    try {
      const response = await fetch(`/api/tracking?id=${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prj_tax_rate: taxRate }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error || "Failed to update PPN.");
      }

      setSavedTaxRate(taxRate);
      setTaxRateInput(String(taxRate));
      await showSuccess("PPN updated", `The PPN rate has been updated to ${taxRate}%.`);
      return true;
    } catch (error) {
      setTaxRateInput(String(savedTaxRate));
      await showAlertValidationError(error instanceof Error ? error.message : "Failed to update PPN.");
      return false;
    } finally {
      setSavingTaxRate(false);
    }
  };

  const getQuotationFileName = () => {
    const quotationCode = quotationNoInput.trim().replace(/[^a-z0-9_.-]+/gi, "-");
    return `${quotationCode || "QUO-PREVIEW"}.pdf`;
  };

  // FUNGSI UNTUK EKSPOR KE PDF (SESUAI KODE YANG ANDA BERIKAN)
  const createQuotationPdf = async () => {
    const companyLogo = await loadCompanyLogo();
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const marginX = 10;
    const contentLeft = 16;
    const contentRight = pageWidth - 16;

    const brown: [number, number, number] = [205, 159, 126];
    const black: [number, number, number] = [0, 0, 0];
    const companyName = String(projectDetail?.dbest?.name ?? "").trim() || "-";
    const companyAddress = String(projectDetail?.dbest?.address ?? "").trim() || "-";

    const formatRupiah = (value: number | null | undefined) =>
      Number(value ?? 0).toLocaleString("en-US");

    // Fungsi untuk menggambar bingkai di setiap halaman
    const drawPageBorder = () => {
      doc.setDrawColor(...black);
      doc.setLineWidth(0.7);
      doc.rect(marginX, 6, pageWidth - marginX * 2, pageHeight - 12);
    };

    // Fungsi untuk menggambar KONTEN header (info, logo, dll)
    const drawHeaderContent = () => {
      // COMPANY INFO
      doc.setTextColor(...black);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(companyName.toUpperCase(), contentLeft, 16);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const addressLines = doc.splitTextToSize(companyAddress, 82).slice(0, 3);
      addressLines.forEach((line: string, index: number) => doc.text(line, contentLeft, 22 + index * 5));

      // LOGO AREA
      if (companyLogo) doc.addImage(companyLogo, "PNG", 144, 10, 48, 25, undefined, "FAST");

      // QUOTATION INFO
      doc.setTextColor(...black);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Quotation For", contentLeft, 50);

      const dateToFormat = projectDetail?.quotationStartDate
        ? new Date(projectDetail.quotationStartDate)
        : new Date(); // Keep using new Date() as a fallback
      const formattedDate = dateToFormat.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      doc.setFontSize(9);

      const formatPeriodDate = (value: unknown) => {
        const date = value ? new Date(String(value)) : null;
        return date && !Number.isNaN(date.getTime())
          ? date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
          : "-";
      };
      const projectPeriod = `${formatPeriodDate(projectDetail?.draftStartDate)} - ${formatPeriodDate(projectDetail?.draftEndDate)}`;

      // KIRI
      doc.setFont("helvetica", "normal");
      doc.text("Brand", contentLeft, 57);
      doc.text("Period", contentLeft, 63);
      doc.text("Project", contentLeft, 69);
      doc.text(`: ${String(projectDetail?.brand ?? "-").toUpperCase()}`, 44, 57);
      doc.text(`: ${projectPeriod}`, 44, 63);
      doc.text(`: ${String(projectDetail?.name ?? "-")}`, 44, 69);

      // KANAN
      const rightLabelX = 118;
      const rightColonX = 146;
      const rightValueX = 150;
      doc.text("Date", rightLabelX, 57);
      doc.text("Quotation No", rightLabelX, 63);
      doc.text(":", rightColonX, 57);
      doc.text(":", rightColonX, 63);
      doc.text(formattedDate, rightValueX, 57);
      doc.text(quotationNoInput.trim() || "-", rightValueX, 63);
    };

    // Panggil kedua fungsi untuk halaman pertama
    drawPageBorder();
    drawHeaderContent();

    // =====================================================
    // 5. TABEL CREATOR
    // =====================================================
    const quotationRows = creators.reduce<any[]>((rows, creator) => {
      if (creator.pricingType !== "BUNDLE" || !creator.bundleId) {
        rows.push(creator);
        return rows;
      }
      if (!creator.isBundleLead) return rows;

      const members = creators.filter((item) => item.bundleId === creator.bundleId);
      rows.push({
        ...creator,
        name: `${creator.name ?? "-"} (Bundling)`,
        sow: members.map((item) => `- ${item.drf_qty ?? 0}x ${item.sow ?? "-"}`).join("\n"),
        platform: [...new Set(members.map((item) => item.platform ?? "-"))].join(" / "),
        drf_qty: "1 bundle",
        rateCard: null,
        markupPrice: creator.bundlePrice,
        total: creator.bundlePrice,
      });
      return rows;
    }, []);

    autoTable(doc, {
      startY: 84,

      head: [["Description", "SOW", "Platform", "Qty", "Rate Card", "Total"]],

      body: quotationRows.map((creator) => [
        creator.name || "-",

        creator.sow ?? "-",

        creator.platform || "Instagram & Tiktok",
        creator.drf_qty ?? "-",
        `Rp ${formatRupiah(creator.markupPrice)}`,
        `Rp ${formatRupiah(creator.total)}`,
      ]),

      theme: "grid",

      headStyles: {
        fillColor: brown,
        textColor: black,
        fontStyle: "bold",
        fontSize: 8.5,
        halign: "center",
        valign: "middle",
        lineColor: black,
        lineWidth: 0.35,
        cellPadding: { top: 2, right: 2, bottom: 2, left: 2 },
      },

      bodyStyles: {
        textColor: black,
        fontSize: 8,
        valign: "middle",
        lineColor: black,
        lineWidth: 0.35,
        cellPadding: { top: 1.8, right: 2, bottom: 1.8, left: 2 },
        minCellHeight: 7,
      },

      didDrawPage: () => drawPageBorder(), // Gambar HANYA bingkai setiap kali tabel membuat halaman baru

      columnStyles: {
        0: {
          cellWidth: 35,
          halign: "left",
        },

        1: {
          cellWidth: 50,
          halign: "left",
        },

        2: {
          cellWidth: 23,
          halign: "center",
        },

        3: {
          cellWidth: 14,
          halign: "center",
        },
        4: {
          cellWidth: 28,
          halign: "right",
        },
        5: {
          cellWidth: 28,
          halign: "right",
        },
      },

      margin: {
        left: contentLeft,
        right: contentLeft,
      },
    });

    const brandApprovers = (Array.isArray(projectDetail?.brandApprovers)
      ? projectDetail.brandApprovers
      : []
    ).filter(
      (approver: { name?: string; title?: string }) =>
        String(approver?.name ?? "").trim() &&
        String(approver?.title ?? "").trim()
    ) as Array<{ name: string; title: string }>;
    const displayedApprovers = brandApprovers.length > 0
      ? brandApprovers.slice(0, 5)
      : [{ name: "-", title: "-" }];

    let currentY = (doc as any).lastAutoTable.finalY;

    // Keep the summary with the content table whenever the complete box still fits.
    const summaryHeight = 5 + 4 * 6;
    // Leave a comfortable bottom margin; a nearly full content page should
    // place the complete summary box on the following page.
    if (currentY + summaryHeight > pageHeight - 45) {
      doc.addPage();
      drawPageBorder();
      currentY = 20;
    }

    // =====================================================
    // 6. SUMMARY TOTAL
    // =====================================================
    const summaryX = 85;
    const summaryWidth = contentRight - summaryX;
    const labelWidth = 50;
    const rowHeight = 6;

    const summaryRows = [
      {
        label: "Subtotal",
        value: taxSummary.subtotal,
      },
      {
        label: "DPP",
        value: taxSummary.dpp,
      },
      {
        label: `PPN (${taxRate}%)`,
        value: taxSummary.ppn,
      },
      {
        label: "Grand Total",
        value: taxSummary.grandTotal,
      },
    ];

    summaryRows.forEach((row, index) => {
    const y = currentY + 5 + index * rowHeight;

      doc.setFillColor(...brown);
      doc.setDrawColor(...black);
      doc.setLineWidth(0.35);

      doc.rect(summaryX, y, labelWidth, rowHeight, "FD");

      doc.rect(summaryX + labelWidth, y, summaryWidth - labelWidth, rowHeight, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);

      doc.text(row.label, summaryX + labelWidth / 2, y + 4.2, {
        align: "center",
      });

      doc.text("Rp", summaryX + labelWidth + 3, y + 4.2);

      doc.text(formatRupiah(row.value), contentRight - 2, y + 4.2, {
        align: "right",
      });
    });

    // =====================================================
    // 7. TERMS & CONDITIONS
    // =====================================================
    // Terms and signatures may move independently so the summary is not pushed
    // away from a table that still has enough room for it.
    const footerHeight = 112;
    let termsY = currentY + 35;
    if (termsY + footerHeight > pageHeight - 12) {
      doc.addPage();
      drawPageBorder();
      termsY = 20;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);

    doc.text("Terms of Payment", contentLeft - 2, termsY);

    doc.text(
      "1. Payment will be made after the campaign is completed.",
      contentLeft - 2,
      termsY + 6
    );

    doc.text(
      "2. Payment is due within 14 days after the invoice is received.",
      contentLeft - 2,
      termsY + 12
    );

    doc.text("Revision Terms", contentLeft - 2, termsY + 23);

    const revisionText = doc.splitTextToSize(
      "1. Maximum revision is 2x (two times). Additional revisions will be charged proportionally.",
      68
    );

    doc.text(revisionText, contentLeft - 2, termsY + 29);

    doc.text("Cancellation & Penalty Fees:", contentLeft - 2, termsY + 45);

    const cancellationText = doc.splitTextToSize(
      "1. Cancellation fee after approval quotation by sign or email is 50% from total project amount.",
      68
    );

    doc.text(cancellationText, contentLeft - 2, termsY + 51);

    // =====================================================
    // 8. SIGNATURE TABLE
    // =====================================================
    const signatureY = termsY + 60;
    const availableSignatureWidth = contentRight - (contentLeft - 2);
    const signatureWidth = Math.max(
      96,
      Math.min(availableSignatureWidth, (displayedApprovers.length + 1) * 32)
    );
    const signatureX = contentRight - signatureWidth;
    const providedWidth = signatureWidth / (displayedApprovers.length + 1);
    const approverWidth = (signatureWidth - providedWidth) / displayedApprovers.length;

    const headerHeight = 7;
    const signHeight = 30;
    const nameHeight = 15;

    doc.setDrawColor(...black);
    doc.setLineWidth(0.35);

    // HEADER
    doc.rect(signatureX, signatureY, providedWidth, headerHeight);
    doc.rect(signatureX + providedWidth, signatureY, signatureWidth - providedWidth, headerHeight);

    // AREA TANDA TANGAN
    doc.rect(signatureX, signatureY + headerHeight, providedWidth, signHeight);
    displayedApprovers.forEach((_, index) => {
      doc.rect(
        signatureX + providedWidth + index * approverWidth,
        signatureY + headerHeight,
        approverWidth,
        signHeight
      );
    });

    // NAMA
    doc.rect(
      signatureX,
      signatureY + headerHeight + signHeight,
      providedWidth,
      nameHeight
    );
    displayedApprovers.forEach((_, index) => {
      doc.rect(
        signatureX + providedWidth + index * approverWidth,
        signatureY + headerHeight + signHeight,
        approverWidth,
        nameHeight
      );
    });

    // HEADER TEXT
    doc.setFont("times", "bold");
    doc.setFontSize(10);

    doc.text("Provided by", signatureX + providedWidth / 2, signatureY + 5, {
      align: "center",
    });

    doc.text(
      "Approved By",
      signatureX + providedWidth + (signatureWidth - providedWidth) / 2,
      signatureY + 5,
      { align: "center" }
    );

    // NAMA
    const nameY = signatureY + headerHeight + signHeight + 6;

    doc.setFontSize(displayedApprovers.length >= 4 ? 7 : 9);
    doc.text("Donna Bella", signatureX + providedWidth / 2, nameY, {
      align: "center",
      maxWidth: providedWidth - 4,
    });
    displayedApprovers.forEach((approver, index) => {
      const centerX = signatureX + providedWidth + index * approverWidth + approverWidth / 2;
      doc.text(String(approver.name).trim(), centerX, nameY, {
        align: "center",
        maxWidth: approverWidth - 3,
      });
      doc.text(String(approver.title).trim(), centerX, nameY + 5, {
        align: "center",
        maxWidth: approverWidth - 3,
      });
    });

    // =====================================================
    // 9. SAVE PDF
    // =====================================================
    return doc;
  };

  const handleExportToPdf = async () => {
    if (!quotationNoInput.trim()) {
      await showAlertValidationError("Complete Quotation No before exporting the quotation.");
      return;
    }
    if (!Array.isArray(projectDetail?.brandApprovers) || projectDetail.brandApprovers.length === 0) {
      await showAlertValidationError("Configure at least one approver name and title in Master Data Brand before exporting.");
      return;
    }
    (await createQuotationPdf()).save(getQuotationFileName());
  };

  const sendQuotationPdf = async (pdf: Blob, filename: string) => {
    if (!projectDetail?.id) {
      await showAlertValidationError("Project data was not found.");
      return;
    }

    try {
      setSending(true);
      const formData = new FormData();
      formData.append("quotation", pdf, filename);

      const response = await fetch(
        `/api/tracking/${projectDetail.id}/send-quotation`,
        { method: "POST", body: formData }
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Failed to send quotation.");
      }

      await showSuccess("Email sent", `Quotation has been sent to ${result.email}.`);
    } catch (error) {
      await showAlertValidationError(
        error instanceof Error ? error.message : "Failed to send quotation."
      );
    } finally {
      setSending(false);
    }
  };

  const handleSendPdf = async () => {
    if (!uploadedPdf) {
      await showAlertValidationError("Upload a PDF before sending it to the brand.");
      return;
    }

    await sendQuotationPdf(uploadedPdf, uploadedPdf.name);
  };

  const handleUploadPdf = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      await showAlertValidationError("Please select a PDF file.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setUploadedPdf(file);
    setPreviewUrl(URL.createObjectURL(file));
    setIsPreviewOpen(false);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-7">
      <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Creator List</h2>
      <p className="mt-1 text-sm text-slate-600">Creators included in this quotation.</p>

      {/* Show Entries */}
      <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="text-xs text-slate-500">10 entries per page</p>
      </div>

<CreatorTable
  creators={creators}
  handleSort={handleSort} // Tambahkan baris ini
  getSortIcon={getSortIcon} // Tambahkan baris ini
  showView={showView}
  onView={onView}
/>

      <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="w-full max-w-md rounded-xl border border-orange-200 bg-orange-50/70 p-4 sm:p-5">
          <label htmlFor="quotation-no" className="mb-2 block text-sm font-semibold text-slate-800">
            Quotation No
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="quotation-no"
              value={quotationNoInput}
              maxLength={100}
              disabled={savingQuotationNo}
              onChange={(event) => setQuotationNoInput(event.target.value)}
              onBlur={() => void saveQuotationNo()}
              onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
              className="h-11 min-w-0 flex-1 rounded-lg border border-orange-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              placeholder="Enter Quotation No"
            />
            <button
              type="button"
              disabled={savingQuotationNo || !quotationNoInput.trim() || quotationNoInput.trim() === savedQuotationNo}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void saveQuotationNo()}
              className={`h-11 rounded-lg px-5 text-sm font-semibold text-white transition ${quotationNoInput.trim() === savedQuotationNo ? "cursor-default bg-emerald-500" : "bg-orange-500 hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300"}`}
            >
              {savingQuotationNo ? "Saving..." : quotationNoInput.trim() === savedQuotationNo ? "Saved" : "Save"}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Used on the quotation PDF and linked invoice.
          </p>
        </div>

  <div className="w-full max-w-[430px] rounded-xl border bg-yellow-50 p-4 sm:p-6">

    <Row
      label="Subtotal"
      value={taxSummary.subtotal}
    />

    <Row
      label="DPP"
      value={taxSummary.dpp}
    />

    <div className="mb-3 flex items-center justify-between gap-4">
      <label htmlFor="tax-rate" className="font-medium">PPN (%) <span className="text-red-500">*</span></label>
      <input id="tax-rate" type="number" min="0" max="100" step="0.01" value={taxRateInput}
        disabled={readOnly || savingTaxRate}
        aria-invalid={!taxRateIsValid}
        onChange={(event) => setTaxRateInput(event.target.value)}
        onBlur={() => void saveTaxRate()}
        className={`w-24 rounded-md border px-3 py-2 text-right disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 ${taxRateIsValid ? "border-slate-300" : "border-red-500 bg-red-50"}`} />
    </div>
    <Row label={`PPN (${taxRate}%)`} value={taxSummary.ppn} />

    <div className="mt-4 flex justify-between border-t pt-4 text-xl font-bold">
      <span>Grand Total</span>

      <span>
        Rp{" "}
        {taxSummary.grandTotal.toLocaleString("en-US")}
      </span>
    </div>

  </div>
      </div>

<div className="mt-6 h-2 rounded-full bg-slate-300">
  <div className="h-2 w-1/3 rounded-full bg-slate-200" />
</div>

      {uploadedPdf && previewUrl && (
        <div className="mt-6 flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><FileDocumentIcon className="h-5 w-5" /></div>
            <div className="min-w-0"><p className="text-sm font-bold text-slate-900">PDF Ready to Send</p><p className="truncate text-xs text-slate-600">{uploadedPdf.name}</p></div>
          </div>
          <button type="button" onClick={() => setIsPreviewOpen(true)} className="inline-flex w-full justify-center rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 sm:w-auto">Preview PDF</button>
        </div>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
        <button
          onClick={handleExportToPdf}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold transition hover:bg-slate-50 sm:w-auto"
        >
          <FileDocumentIcon className="h-4 w-4" />
          Download PDF
        </button>

        <input
          ref={uploadInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={handleUploadPdf}
        />

        <button
          type="button"
          onClick={() => uploadInputRef.current?.click()}
          disabled={sending}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          <FileDocumentIcon className="h-4 w-4" />
          Upload PDF
        </button>

        <button
          onClick={handleSendPdf}
          disabled={sending || !uploadedPdf}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          <FileDocumentIcon className="h-4 w-4" />
          {sending ? "Sending..." : "Send PDF"}
        </button>

        {!readOnly && (
          <button
            onClick={async () => {
              if (!taxRateIsValid) {
                await showAlertValidationError("PPN must be a number between 0 and 100.");
                return;
              }
              handleStartProject(taxRate);
            }}
            className="w-full rounded-xl bg-black px-6 py-3 text-sm font-semibold text-white sm:w-auto"
          >
            Start Project
          </button>
        )}
      </div>

      {isPreviewOpen && previewUrl && (
        <div role="dialog" aria-modal="true" aria-label="Quotation PDF preview" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={() => setIsPreviewOpen(false)}>
          <div className="flex h-[72vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3"><div className="min-w-0"><p className="text-sm font-bold text-slate-900">Quotation PDF Preview</p><p className="truncate text-xs text-slate-500">{uploadedPdf?.name}</p></div><button type="button" onClick={() => setIsPreviewOpen(false)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Close</button></div>
            <iframe title="Quotation PDF preview" src={previewUrl} className="min-h-0 flex-1 bg-slate-100" />
          </div>
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: any;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-400">
        {label}
      </label>

      <input
        value={value ?? ""}
        readOnly
        className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4"
      />
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  return (
    <div className="mb-2 flex justify-between">
      <span>{label}</span>

      <span>
        Rp {Number(value ?? 0).toLocaleString("en-US")}
      </span>
    </div>
  );
}
