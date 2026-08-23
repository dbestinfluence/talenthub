import { ReactNode, useState } from "react";
import FileDocumentIcon from "@/components/icons/FileDocumentIcon";
import CreatorTable from "./CreatorTable";
import { exportToExcel } from "@/lib/excelExport";
import { showAlertValidationError, showSuccess } from "@/lib/alert";

type DraftSectionProps = {
  creators: any[];
  projectDetail: any;

  handleDelete: (id: number) => void;
  handleEditDraft: () => void;
  handleGenerateQuotation: () => void;

  handleSort: (field: string) => void;
  getSortIcon: (field: string) => ReactNode;
  readOnly?: boolean;
  showView?: boolean;
  onView?: (creator: any) => void;
  sowOptions: { sow_id: number; sow_nama: string | null }[];
  onSowChange: (creatorId: number, sowId: number | null) => void;
  invalidSowCreatorIds?: number[];
  onDraftPriceChange: (creatorId: number, field: "rateCard" | "markupPrice" | "qty", value: number | null) => void;
  invalidPricingFields?: Record<number, { rateCard: boolean; markupPrice: boolean; qty: boolean }>;
  onAddSow: (creatorId: number) => void;
};

export default function DraftSection({
  creators,
  projectDetail,
  handleDelete,
  handleEditDraft,
  handleGenerateQuotation,
  handleSort,
  getSortIcon,
  showView,
  onView,
  sowOptions,
  onSowChange,
  invalidSowCreatorIds,
  onDraftPriceChange,
  invalidPricingFields,
  onAddSow,
  readOnly = false,
}: DraftSectionProps) {
  const [sending, setSending] = useState(false);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(projectDetail?.spreadsheetUrl ?? null);

  const handleDownload = () => {
    // Use project code for filename, fallback to a static name
    const fileName = projectDetail?.prj_kode ?? "Project_Draft";
    exportToExcel(creators, projectDetail, fileName);
  };

  const handleSendSpreadsheet = async () => {
    if (!projectDetail?.id) {
      await showAlertValidationError("Project data was not found.");
      return;
    }

    try {
      setSending(true);
      const response = await fetch(
        `/api/tracking/${projectDetail.id}/send-spreadsheet`,
        { method: "POST" }
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Failed to send spreadsheet.");
      }

      setSpreadsheetUrl(result.spreadsheetUrl ?? null);

      await showSuccess(
        "Email sent",
        `Google Spreadsheet has been shared and sent to ${result.email}.`
      );
    } catch (error) {
      await showAlertValidationError(
        error instanceof Error ? error.message : "Failed to send spreadsheet."
      );
    } finally {
      setSending(false);
    }
  };
  return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-7">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Creator List</h2>
          <p className="text-sm text-slate-700">Data from Creator</p>

          <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-slate-500">10 entries per page</p>

          {!readOnly && (
            <button
              onClick={handleEditDraft}
              className="w-full rounded-xl border border-slate-300 bg-white px-6 py-2 text-sm font-semibold text-slate-800 md:w-auto"
            >
              ✎ Edit Draft
            </button>
          )}
          </div>

          <CreatorTable
            creators={creators}
            handleSort={handleSort}
            getSortIcon={getSortIcon}
            showDelete={!readOnly}
            onDelete={handleDelete}
            showView={showView}
            onView={onView}
            sowOptions={sowOptions}
            onSowChange={onSowChange}
            sowReadOnly={readOnly}
            invalidSowCreatorIds={invalidSowCreatorIds}
            draftPricingMode
            draftPricingEditable={!readOnly}
            onDraftPriceChange={onDraftPriceChange}
            invalidPricingFields={invalidPricingFields}
            onAddSow={onAddSow}
          />

          <div className="mt-6 h-2 rounded-full bg-slate-300">
            <div className="h-2 w-1/3 rounded-full bg-slate-200" />
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">

          <button
            onClick={handleDownload}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold transition hover:bg-slate-50 md:w-auto"
          >
            <FileDocumentIcon className="h-4 w-4" />
            Download Excel
          </button>
          {spreadsheetUrl && (
            <a
              href={spreadsheetUrl}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-6 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 md:w-auto"
            >
              <FileDocumentIcon className="h-4 w-4" />
              Open Google Sheet
            </a>
          )}
          <button
            onClick={handleSendSpreadsheet}
            disabled={sending}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
          >
            <FileDocumentIcon className="h-4 w-4" />
            {sending ? "Sending Link..." : "Send Link Spreadsheet"}
          </button>
          {!readOnly && (
            <button
              onClick={handleGenerateQuotation}
              className="w-full rounded-xl bg-black px-6 py-3 text-center text-sm font-semibold text-white md:w-auto"
            >
              Generate Quotation
            </button>
          )}

          </div>
        </section>
  );
}
