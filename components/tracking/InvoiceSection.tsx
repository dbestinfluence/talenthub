import { ChangeEvent, ReactNode, useEffect, useRef, useState } from "react";
import FileDocumentIcon from "@/components/icons/FileDocumentIcon";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { loadCompanyLogo } from "@/lib/pdf-branding";
import { showAlertValidationError, showSuccess } from "@/lib/alert";
import { calculateTaxSummary } from "@/lib/tax";
import CreatorTable from "./CreatorTable";

type Props = {
  projectDetail: any;
  creators: any[];
  handleSort: (field: string) => void;
  getSortIcon: (field: string) => ReactNode;
  handleFinish: () => void;
  showView?: boolean;
  onView?: (creator: any) => void;
  readOnly?: boolean;
};

const formatRupiah = (value: number | null | undefined) =>
  `Rp ${Number(value ?? 0).toLocaleString("en-US")}`;
const formatAmount = (value: number | null | undefined) =>
  Number(value ?? 0).toLocaleString("en-US");

export default function InvoiceSection({
  projectDetail,
  creators,
  handleSort,
  getSortIcon,
  handleFinish,
  showView,
  onView,
  readOnly = false,
}: Props) {
  const [sending, setSending] = useState(false);
  const [uploadedPdf, setUploadedPdf] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const initialInvoiceTaxRate = Number(projectDetail?.invoiceTaxRate ?? projectDetail?.taxRate ?? 11);
  const [invoiceTaxRateInput, setInvoiceTaxRateInput] = useState(() => String(initialInvoiceTaxRate));
  const [savedInvoiceTaxRate, setSavedInvoiceTaxRate] = useState(initialInvoiceTaxRate);
  const [savingInvoiceTaxRate, setSavingInvoiceTaxRate] = useState(false);
  const [invoiceNoInput, setInvoiceNoInput] = useState(() => String(projectDetail?.invoiceNo ?? ""));
  const [savedInvoiceNo, setSavedInvoiceNo] = useState(() => String(projectDetail?.invoiceNo ?? ""));
  const [poNoInput, setPoNoInput] = useState(() => String(projectDetail?.poNo ?? ""));
  const [savedPoNo, setSavedPoNo] = useState(() => String(projectDetail?.poNo ?? ""));
  const [savingDocumentField, setSavingDocumentField] = useState<"invoice" | "po" | null>(null);
  const invoiceTaxRate = Number(invoiceTaxRateInput);
  const invoiceTaxRateIsValid = invoiceTaxRateInput.trim() !== ""
    && Number.isFinite(invoiceTaxRate)
    && invoiceTaxRate >= 0
    && invoiceTaxRate <= 100;
  const taxSummary = calculateTaxSummary(
    Number(projectDetail?.subtotal ?? 0),
    invoiceTaxRateIsValid ? invoiceTaxRate : savedInvoiceTaxRate,
  );
  const uploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    const nextRate = Number(projectDetail?.invoiceTaxRate ?? projectDetail?.taxRate ?? 11);
    setInvoiceTaxRateInput(String(nextRate));
    setSavedInvoiceTaxRate(nextRate);
  }, [projectDetail?.id, projectDetail?.invoiceTaxRate, projectDetail?.taxRate]);

  useEffect(() => {
    const nextInvoiceNo = String(projectDetail?.invoiceNo ?? "");
    const nextPoNo = String(projectDetail?.poNo ?? "");
    setInvoiceNoInput(nextInvoiceNo);
    setSavedInvoiceNo(nextInvoiceNo);
    setPoNoInput(nextPoNo);
    setSavedPoNo(nextPoNo);
  }, [projectDetail?.id, projectDetail?.invoiceNo, projectDetail?.poNo]);

  const saveDocumentField = async (field: "invoice" | "po") => {
    if (savingDocumentField) return;
    const value = (field === "invoice" ? invoiceNoInput : poNoInput).trim();
    const savedValue = field === "invoice" ? savedInvoiceNo : savedPoNo;
    if (!value) {
      await showAlertValidationError(`${field === "invoice" ? "Invoice No" : "PurchaseOrder No"} is required.`);
      if (field === "invoice") setInvoiceNoInput(savedInvoiceNo);
      else setPoNoInput(savedPoNo);
      return;
    }
    if (value === savedValue) return;

    setSavingDocumentField(field);
    try {
      const response = await fetch(`/api/tracking?id=${projectDetail?.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(field === "invoice" ? { prj_invoiceno: value } : { prj_po_no: value }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Failed to update document number.");
      if (field === "invoice") {
        setInvoiceNoInput(value);
        setSavedInvoiceNo(value);
      } else {
        setPoNoInput(value);
        setSavedPoNo(value);
      }
      await showSuccess("Document number updated", `${field === "invoice" ? "Invoice No" : "PurchaseOrder No"} has been saved.`);
    } catch (error) {
      if (field === "invoice") setInvoiceNoInput(savedInvoiceNo);
      else setPoNoInput(savedPoNo);
      await showAlertValidationError(error instanceof Error ? error.message : "Failed to update document number.");
    } finally {
      setSavingDocumentField(null);
    }
  };

  const saveInvoiceTaxRate = async () => {
    if (readOnly || savingInvoiceTaxRate) return;

    if (!invoiceTaxRateIsValid) {
      await showAlertValidationError("Invoice PPN must be a number between 0 and 100.");
      setInvoiceTaxRateInput(String(savedInvoiceTaxRate));
      return;
    }

    if (invoiceTaxRate === savedInvoiceTaxRate) return;

    try {
      setSavingInvoiceTaxRate(true);
      const response = await fetch(`/api/tracking?id=${projectDetail?.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prj_invoice_tax_rate: invoiceTaxRate }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Failed to update Invoice PPN.");

      setSavedInvoiceTaxRate(invoiceTaxRate);
      await showSuccess("Invoice PPN updated", `The invoice PPN rate has been updated to ${invoiceTaxRate}%.`);
    } catch (error) {
      setInvoiceTaxRateInput(String(savedInvoiceTaxRate));
      await showAlertValidationError(error instanceof Error ? error.message : "Failed to update Invoice PPN.");
    } finally {
      setSavingInvoiceTaxRate(false);
    }
  };
  const payment = projectDetail?.payment;
  const documentRows = creators.reduce<any[]>((rows, creator) => {
    if (creator.pricingType !== "BUNDLE" || !creator.bundleId) {
      rows.push(creator);
      return rows;
    }
    if (!creator.isBundleLead) return rows;

    const members = creators.filter((item) => item.bundleId === creator.bundleId);
    rows.push({
      ...creator,
      rowKey: creator.bundleId,
      sow: `Bundling: ${members.map((item) => `${item.drf_qty ?? 0}x ${item.sow ?? "-"}`).join("; ")}`,
      platform: [...new Set(members.map((item) => item.platform ?? "-"))].join(" / "),
      drf_qty: "1 bundle",
      rateCard: null,
      markupPrice: creator.bundlePrice,
      total: creator.bundlePrice,
    });
    return rows;
  }, []);

  const getFileName = () => {
    const invoiceNo = invoiceNoInput.trim().replace(/[^a-z0-9_.-]+/gi, "-");
    return `Invoice_${invoiceNo || projectDetail?.name || "Project"}.pdf`;
  };

  const createInvoicePdf = async () => {
    const companyLogo = await loadCompanyLogo();
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const right = pageWidth - 16;
    const tableRight = pageWidth - 7;
    const black: [number, number, number] = [0, 0, 0];
    const companyName = String(projectDetail?.dbest?.name ?? "").trim() || "-";
    const companyAddress = String(projectDetail?.dbest?.address ?? "").trim() || "-";

    const drawPageDecoration = () => {
      doc.setFillColor(250, 224, 210);
      doc.rect(7, 7, pageWidth - 14, 4, "F");
    };

    drawPageDecoration();
    doc.setTextColor(...black);
    if (companyLogo) doc.addImage(companyLogo, "PNG", 8, 13, 38, 18, undefined, "FAST");
    else {
      doc.setFont("times", "bolditalic");
      doc.setFontSize(18);
      doc.text(companyName, 8, 20);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("INVOICE", right, 20, { align: "right" });

    const invoiceDate = projectDetail?.invoiceStartDate
      ? new Date(projectDetail.invoiceStartDate)
      : new Date();
    const formattedDate = invoiceDate.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const numberBoxX = 107;
    const numberBoxWidth = 42;
    const numberBox = (label: string, value: string, y: number) => {
      doc.setFillColor(250, 224, 210);
      doc.rect(numberBoxX, y, numberBoxWidth, 5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(label, numberBoxX + numberBoxWidth / 2, y + 3.5, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.text(value || "-", numberBoxX + numberBoxWidth / 2, y + 8, { align: "center" });
    };
    numberBox("PURCHASEORDER NO", poNoInput.trim() || "-", 17);
    numberBox("INVOICE NO", invoiceNoInput.trim() || "-", 31);
    numberBox("QUOTATION NO", String(projectDetail?.quotationNo ?? "-"), 45);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Invoice To", 8, 33);
    const recipientBrand = String(projectDetail?.brand ?? "").trim().toUpperCase() || "-";
    const recipientPic = String(projectDetail?.brandPic ?? "").trim();
    const recipientEmail = String(projectDetail?.brandEmail ?? "").trim();
    const recipientPhone = String(projectDetail?.brandContact ?? "").trim();
    const recipientAddress = String(projectDetail?.brandAddress ?? "").trim();
    let invoiceToY = 38;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(recipientBrand, 8, invoiceToY);
    invoiceToY += 5;

    doc.setFontSize(8.5);
    const recipientDetails = [
      { label: "PIC", value: recipientPic },
      { label: "Email", value: recipientEmail },
      { label: "Phone", value: recipientPhone },
      { label: "Address", value: recipientAddress },
    ].filter((detail) => detail.value);

    recipientDetails.forEach(({ label, value }) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, 8, invoiceToY);
      doc.text(":", 21, invoiceToY);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(value, 66);
      doc.text(lines, 24, invoiceToY);
      invoiceToY += Math.max(1, lines.length) * 4 + 1;
    });

    const headerLabelX = 154;
    const headerValueX = right;
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.text("Date", headerLabelX, 28);
    doc.setFont("helvetica", "normal");
    doc.text(formattedDate, headerValueX, 28, { align: "right" });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(headerLabelX, 32, headerValueX, 32);

    doc.setFont("helvetica", "bold");
    doc.text("From", headerLabelX, 38);
    const companyNameLines = doc.splitTextToSize(companyName, 34).slice(0, 2);
    companyNameLines.forEach((line: string, index: number) => {
      doc.text(line, headerValueX, 38 + index * 4, { align: "right" });
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const companyAddressY = 44 + Math.max(0, companyNameLines.length - 1) * 4;
    const companyAddressLines = doc.splitTextToSize(companyAddress, 40).slice(0, 3);
    companyAddressLines.forEach((line: string, index: number) => {
      doc.text(line, headerValueX, companyAddressY + index * 4, { align: "right" });
    });

    const invoiceRows = documentRows.map((creator, index) => [
      index + 1,
      creator.name ?? "-",
      `${creator.sow ?? "-"} · ${creator.platform ?? "-"}`,
      formatRupiah(creator.total),
    ]);
    autoTable(doc, {
      startY: Math.max(70, invoiceToY + 4),
      head: [["No.", "Description", "Statement of Work", "Amount"]],
      body: invoiceRows,
      theme: "grid",
      headStyles: { fillColor: [250, 224, 210], textColor: black, fontStyle: "bold", fontSize: 9, halign: "center", lineColor: black, lineWidth: 0.25, minCellHeight: 6 },
      bodyStyles: { textColor: black, fontSize: 8.5, lineColor: black, lineWidth: 0.2, minCellHeight: 6, cellPadding: 1.1 },
      columnStyles: {
        0: { cellWidth: 9, halign: "center" },
        1: { cellWidth: 67 },
        2: { cellWidth: 81 },
        3: { cellWidth: pageWidth - 14 - 9 - 67 - 81, halign: "right" },
      },
      margin: { left: 7, right: 7 },
      didDrawPage: drawPageDecoration,
    });

    let y = (doc as any).lastAutoTable.finalY;
    if (y > pageHeight - 82) {
      doc.addPage();
      drawPageDecoration();
      y = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const paymentY = y + 5;
    doc.text("Payment Method", 8, paymentY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Bank Name     : ${payment?.bank ?? "-"}`, 8, paymentY + 5);
    doc.text(`Account No    : ${payment?.accountNo ?? "-"}`, 8, paymentY + 10);
    doc.text(`Name          : ${payment?.accountName ?? "-"}`, 8, paymentY + 15);

    const rows = [
      ["Total", taxSummary.subtotal],
      ["DPP", taxSummary.dpp],
      [`PPN (${taxSummary.taxRate}%)`, taxSummary.ppn],
      ["TOTAL AMOUNT", taxSummary.grandTotal],
    ];
    // Align the value divider with the main table's Amount column.
    const summaryX = 130;
    const summaryWidth = tableRight - summaryX;
    const labelWidth = 34;
    const rowHeight = 6;

    rows.forEach(([label, value], index) => {
      const rowY = y + index * rowHeight;
      doc.setFillColor(250, 224, 210);
      doc.setDrawColor(...black);
      doc.setLineWidth(0.2);
      doc.rect(summaryX, rowY, labelWidth, rowHeight, "FD");
      doc.rect(summaryX + labelWidth, rowY, summaryWidth - labelWidth, rowHeight, "FD");

      doc.setTextColor(...black);
      doc.setFont("helvetica", index === rows.length - 1 ? "bold" : "normal");
      doc.setFontSize(8.5);
      doc.text(String(label), summaryX + 2, rowY + 4.2);
      doc.text(`Rp ${formatAmount(value as number | null | undefined)}`, tableRight - 1, rowY + 4.2, {
        align: "right",
      });
    });

    const footerY = y + 34;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Terms and Conditions", 8, footerY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(doc.splitTextToSize(
      "Please send payment within 30 days of receiving this invoice. There will be a 1.5% interest charge per month on late invoices.",
      80,
    ), 8, footerY + 5);

    doc.setFontSize(8);
    const signatureCenter = summaryX + summaryWidth / 2;
    doc.text(`Jakarta, ${formattedDate}`, signatureCenter, footerY - 5, { align: "center" });
    doc.text("Donna Bella Apri San", signatureCenter, footerY + 13, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.text("Direktur", signatureCenter, footerY + 18, { align: "center" });
    doc.setFillColor(250, 224, 210);
    doc.rect(7, footerY + 23, pageWidth - 14, 5, "F");

    return doc;
  };

  const handleExportPdf = async () => {
    if (!invoiceNoInput.trim() || !poNoInput.trim()) {
      await showAlertValidationError("Complete Invoice No and PurchaseOrder No before exporting the invoice.");
      return;
    }
    (await createInvoicePdf()).save(getFileName());
  };

  const sendInvoicePdf = async (pdf: Blob, filename: string) => {
    if (!projectDetail?.id) {
      await showAlertValidationError("Project data was not found.");
      return;
    }

    try {
      setSending(true);
      const formData = new FormData();
      formData.append("invoice", pdf, filename);
      const response = await fetch(`/api/tracking/${projectDetail.id}/send-invoice`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Failed to send invoice.");
      await showSuccess("Email sent", `Invoice has been sent to ${result.email}.`);
    } catch (error) {
      await showAlertValidationError(error instanceof Error ? error.message : "Failed to send invoice.");
    } finally {
      setSending(false);
    }
  };

  const handleSendPdf = async () => {
    if (!uploadedPdf) {
      await showAlertValidationError("Upload a PDF before sending it to the brand.");
      return;
    }

    await sendInvoicePdf(uploadedPdf, uploadedPdf.name);
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
      <div>
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Invoice</h2>
        <p className="text-sm text-slate-700">Creator and payment details for this project.</p>
      </div>

      <div className="mt-6 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
        <DocumentField label="PurchaseOrder No" value={poNoInput} readOnly={savingDocumentField !== null} onChange={setPoNoInput} onSave={() => void saveDocumentField("po")} />
        <DocumentField label="Invoice No" value={invoiceNoInput} readOnly={savingDocumentField !== null} onChange={setInvoiceNoInput} onSave={() => void saveDocumentField("invoice")} />
        <DocumentField label="Quotation No" value={String(projectDetail?.quotationNo ?? "")} readOnly onChange={() => undefined} onSave={() => undefined} />
      </div>

      <CreatorTable
        creators={creators}
        handleSort={handleSort}
        getSortIcon={getSortIcon}
        showView={showView}
        onView={onView}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6"><h3 className="text-xl font-bold text-slate-900">Payment Method</h3>{payment ? <div className="mt-6 space-y-4 text-sm"><PaymentRow label="Bank" value={payment.bank} /><PaymentRow label="Account No" value={payment.accountNo} /><PaymentRow label="Account Name" value={payment.accountName} /></div> : <p className="mt-6 text-sm text-slate-500">Payment details are not available for this invoice.</p>}</div>
        <div className="w-full rounded-xl border bg-yellow-50 p-4 sm:p-6">
          <div className="space-y-3 text-sm">
            <TotalRow label="Subtotal" value={formatRupiah(taxSummary.subtotal)} />
            <TotalRow label="DPP" value={formatRupiah(taxSummary.dpp)} />
          </div>

          <div className="mb-3 mt-3 flex items-center justify-between gap-4">
            <label htmlFor="invoice-tax-rate" className="font-medium">
              PPN (%) {!readOnly && <span className="text-red-500">*</span>}
            </label>
            <input
              id="invoice-tax-rate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={invoiceTaxRateInput}
              disabled={readOnly || savingInvoiceTaxRate}
              onChange={(event) => setInvoiceTaxRateInput(event.target.value)}
              onBlur={saveInvoiceTaxRate}
              aria-invalid={!invoiceTaxRateIsValid}
              className={`w-24 rounded-md border px-3 py-2 text-right disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 ${invoiceTaxRateIsValid ? "border-slate-300 bg-white" : "border-red-500 bg-red-50"}`}
            />
          </div>

          <TotalRow label={`PPN (${taxSummary.taxRate}%)`} value={formatRupiah(taxSummary.ppn)} />

          <div className="mt-4 flex justify-between border-t pt-4 text-xl font-bold">
            <span>Grand Total</span>
            <span>{formatRupiah(taxSummary.grandTotal)}</span>
          </div>
        </div>
      </div>

      {uploadedPdf && previewUrl && <div className="mt-6 flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><FileDocumentIcon className="h-5 w-5" /></div><div className="min-w-0"><p className="text-sm font-bold text-slate-900">PDF Ready to Send</p><p className="truncate text-xs text-slate-600">{uploadedPdf.name}</p></div></div><button type="button" onClick={() => setIsPreviewOpen(true)} className="inline-flex w-full justify-center rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 sm:w-auto">Preview PDF</button></div>}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button onClick={handleExportPdf} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold hover:bg-slate-50 sm:w-auto"><FileDocumentIcon className="h-4 w-4" />Export PDF</button>
        <input ref={uploadInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleUploadPdf} />
        <button type="button" onClick={() => uploadInputRef.current?.click()} disabled={sending} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"><FileDocumentIcon className="h-4 w-4" />Upload PDF</button>
        <button onClick={handleSendPdf} disabled={sending || !uploadedPdf} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"><FileDocumentIcon className="h-4 w-4" />{sending ? "Sending..." : "Send PDF"}</button>
        {!readOnly && <button onClick={handleFinish} className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-8 py-3 text-sm font-semibold text-white hover:bg-slate-800 sm:w-auto"><FileDocumentIcon className="h-4 w-4" />Finish</button>}
      </div>

      {isPreviewOpen && previewUrl && <div role="dialog" aria-modal="true" aria-label="Invoice PDF preview" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={() => setIsPreviewOpen(false)}><div className="flex h-[72vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between border-b border-slate-200 px-5 py-3"><div className="min-w-0"><p className="text-sm font-bold text-slate-900">Invoice PDF Preview</p><p className="truncate text-xs text-slate-500">{uploadedPdf?.name}</p></div><button type="button" onClick={() => setIsPreviewOpen(false)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Close</button></div><iframe title="Invoice PDF preview" src={previewUrl} className="min-h-0 flex-1 bg-slate-100" /></div></div>}
    </section>
  );
}

function DocumentField({
  label,
  value,
  readOnly,
  onChange,
  onSave,
}: {
  label: string;
  value: string;
  readOnly: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <input
        value={value}
        maxLength={100}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onSave}
        onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
        className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-4 read-only:cursor-default read-only:bg-slate-100"
        placeholder={`Enter ${label}`}
      />
    </label>
  );
}

function PaymentRow({ label, value }: { label: string; value?: string | null }) { return <div className="flex items-start justify-between gap-6"><span className="text-slate-600">{label}</span><span className="text-right font-semibold text-slate-900">{value ?? "-"}</span></div>; }
function TotalRow({ label, value }: { label: string; value: string }) { return <div className="flex justify-between"><span>{label}</span><span className="font-semibold">{value}</span></div>; }
