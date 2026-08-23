import { ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import CreatorTable from "./CreatorTable";
import ReportIcon from "@/components/icons/ReportIcon";
import FileDocumentIcon from "@/components/icons/FileDocumentIcon";
import { exportDetailReportPdf, type DetailReportPayload } from "@/lib/detail-report-pdf";
import { showAlertValidationError } from "@/lib/alert";

type Props = {
  projectDetail: ({ id?: number } & Record<string, unknown>) | null;
  creators: Record<string, unknown>[];
  handleSort: (field: string) => void;
  getSortIcon: (field: string) => ReactNode;
  handleGenerateInvoice: () => void;
  readOnly?: boolean;
};

export default function ReportSection({
  projectDetail,
  creators,
  handleSort,
  getSortIcon,
  handleGenerateInvoice,
  readOnly = false,
}: Props) {
  const [selectedReportIds, setSelectedReportIds] = useState<number[]>([]);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [openingReportIds, setOpeningReportIds] = useState<number[]>([]);
  const router = useRouter();

  const handleOpenReport = async (detailIds: number[]) => {
    if (!projectDetail?.id || detailIds.length === 0 || openingReportIds.length > 0) return;

    try {
      setOpeningReportIds(detailIds);
      const response = await fetch("/api/tracking/detail-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: projectDetail.id, detailIds }),
      });
      const payload = await response.json().catch(() => ({})) as {
        error?: string;
        results?: Array<{ error?: string; creator?: string }>;
      };
      const failures = payload.results?.filter((result) => result.error) ?? [];
      if (!response.ok && response.status !== 207) {
        throw new Error(payload.error ?? "Failed to update report data.");
      }
      if (failures.length === detailIds.length) {
        throw new Error(failures.map((failure) => `${failure.creator ?? "Creator"}: ${failure.error}`).join("\n"));
      }

      const query = new URLSearchParams({ projectId: String(projectDetail.id) });
      detailIds.forEach((id) => query.append("detailIds", String(id)));
      router.push(`/tracking/report/detail-report?${query.toString()}`);
    } catch (error) {
      await showAlertValidationError(error instanceof Error ? error.message : "Failed to update report data.");
      setOpeningReportIds([]);
    }
  };

  const handleExportPdf = async () => {
    if (!projectDetail?.id) {
      await showAlertValidationError("Project data was not found.");
      return;
    }

    try {
      setExportingPdf(true);
      const response = await fetch(`/api/tracking/detail-report?projectId=${projectDetail.id}`, { cache: "no-store" });
      const payload = await response.json() as DetailReportPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Failed to load detail report data.");
      if (!payload.items.some((item) => item.report)) {
        throw new Error("No analytic data is available yet. Open Detail Report to fetch creator metadata first.");
      }
      await exportDetailReportPdf(payload);
    } catch (error) {
      await showAlertValidationError(error instanceof Error ? error.message : "Failed to export PDF.");
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-7">
      <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">List Result Report</h2>
      <p className="text-sm text-slate-700">Data from Creator</p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">10 entries per page</p>
        <button
          type="button"
          aria-disabled={selectedReportIds.length === 0}
          disabled={selectedReportIds.length === 0 || openingReportIds.length > 0}
          onClick={() => void handleOpenReport(selectedReportIds)}
          className={`flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold transition sm:w-auto ${selectedReportIds.length && openingReportIds.length === 0 ? "text-slate-700 hover:bg-slate-50" : "cursor-not-allowed text-slate-400 opacity-60"}`}
        >
          <ReportIcon className="h-5 w-5" />
          {openingReportIds.length > 0 ? "Updating report data..." : `View Report (${selectedReportIds.length})`}
        </button>
      </div>

      <CreatorTable
        creators={creators}
        handleSort={handleSort}
        getSortIcon={getSortIcon}
        showView
        reportMode
        selectedReportIds={selectedReportIds}
        onReportSelectionChange={setSelectedReportIds}
        onOpenReport={(ids) => void handleOpenReport(ids)}
        openingReportIds={openingReportIds}
      />

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
        <button
          type="button"
          onClick={handleExportPdf}
          disabled={exportingPdf}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          <FileDocumentIcon className="h-4 w-4" />
          {exportingPdf ? "Preparing PDF..." : "Export PDF"}
        </button>
        {!readOnly && (
          <button
            onClick={handleGenerateInvoice}
            className="w-full rounded-xl bg-black px-6 py-3 text-sm font-semibold text-white sm:w-auto"
          >
            Generate Invoice
          </button>
        )}
      </div>
    </section>
  );
}
