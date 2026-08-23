import { ReactNode } from "react";
import FileDocumentIcon from "@/components/icons/FileDocumentIcon"; // Import FileDocumentIcon
import CreatorTable from "./CreatorTable";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { loadCompanyLogo } from "@/lib/pdf-branding";

type RunningCreator = {
  drf_id: number;
  drf_creatorid: number;
  name?: string | null;
  username?: string | null;
  sow?: string | null;
  platform?: string | null;
  drf_planning_upload?: string | Date | null;
  drf_actual_upload?: string | Date | null;
  drf_link_content?: string | null;
  [key: string]: unknown;
};

type RunningProject = {
  brand?: string | null;
  name?: string | null;
  code?: string | null;
  createdBy?: string | null;
  runningStartDate?: string | Date | null;
  runningEndDate?: string | Date | null;
  dbest?: { name?: string | null; address?: string | null } | null;
};

type Props = {
  creators: RunningCreator[];
  projectDetail: RunningProject | null;
  checkedCreators: number[];
  handleSort: (field: string) => void;
  getSortIcon: (field: string) => ReactNode;
  handleUpdateRunningContent: (creator: RunningCreator, mode: "edit" | "view") => void;
  handleGenerateReport: () => void;
  readOnly?: boolean;
  invalidRunningFields?: Record<number, {
    planningUpload: boolean;
    actualUpload: boolean;
    linkContent: boolean;
  }>;
};

export default function RunningSection({
  creators,
  projectDetail,
  checkedCreators,
  handleSort,
  getSortIcon,
  handleUpdateRunningContent,
  handleGenerateReport,
  readOnly = false,
  invalidRunningFields,
}: Props) {
  const handleExportToPdf = async () => {
    const companyLogo = await loadCompanyLogo();
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const left = 16;
    const brown: [number, number, number] = [205, 159, 126];
    const black: [number, number, number] = [0, 0, 0];
    const companyName = String(projectDetail?.dbest?.name ?? "").trim() || "-";
    const companyAddress = String(projectDetail?.dbest?.address ?? "").trim() || "-";

    const drawBorder = () => {
      doc.setDrawColor(...black);
      doc.setLineWidth(0.7);
      doc.rect(10, 6, pageWidth - 20, pageHeight - 12);
    };

    const formatDate = (value: string | Date | null | undefined) => value
      ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : "-";

    drawBorder();
    doc.setTextColor(...black);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(companyName.toUpperCase(), left, 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.splitTextToSize(companyAddress, 95).slice(0, 3).forEach((line: string, index: number) => doc.text(line, left, 22 + index * 5));

    if (companyLogo) {
      doc.addImage(companyLogo, "PNG", pageWidth - 67, 10, 50, 28, undefined, "FAST");
    }

    doc.setTextColor(...black);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("CAMPAIGN RUNNING REPORT", left, 51);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Brand : ${String(projectDetail?.brand ?? "-").toUpperCase()}`, left, 59);
    doc.text(`Project : ${projectDetail?.name ?? "-"}`, left, 65);
    doc.text(`Project Code : ${projectDetail?.code ?? "-"}`, left, 71);
    doc.text(`PIC : ${projectDetail?.createdBy ?? "-"}`, 157, 59);
    doc.text(`Status : Running`, 157, 65);
    doc.text(`Running Period : ${formatDate(projectDetail?.runningStartDate)} - ${formatDate(projectDetail?.runningEndDate)}`, 157, 71);

    autoTable(doc, {
      startY: 79,
      head: [["No.", "Influencer", "Username", "SOW", "Platform", "Planning Upload", "Actual Upload", "Content", "Progress"]],
      body: creators.map((creator, index) => {
        const completed = creator.drf_actual_upload && creator.drf_link_content;
        return [
          index + 1,
          creator.name ?? "-",
          creator.username ?? "-",
          creator.sow ?? "-",
          creator.platform ?? "-",
          formatDate(creator.drf_planning_upload),
          formatDate(creator.drf_actual_upload),
          creator.drf_link_content ? "Available" : "-",
          completed ? "Completed" : "In Progress",
        ];
      }),
      theme: "grid",
      margin: { left, right: left },
      headStyles: {
        fillColor: brown,
        textColor: black,
        fontStyle: "bold",
        halign: "center",
        valign: "middle",
        fontSize: 8,
        lineColor: black,
        lineWidth: 0.3,
      },
      bodyStyles: {
        textColor: black,
        fontSize: 8,
        valign: "middle",
        lineColor: black,
        lineWidth: 0.25,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 36 },
        2: { cellWidth: 31 },
        3: { cellWidth: 34 },
        4: { cellWidth: 20, halign: "center" },
        5: { cellWidth: 30, halign: "center" },
        6: { cellWidth: 30, halign: "center" },
        7: { cellWidth: 22, halign: "center" },
        8: { cellWidth: 28, halign: "center" },
      },
      didDrawPage: drawBorder,
    });

    const completedCount = creators.filter((creator) => creator.drf_actual_upload && creator.drf_link_content).length;
    const tableDocument = doc as jsPDF & { lastAutoTable: { finalY: number } };
    const summaryY = Math.min(tableDocument.lastAutoTable.finalY + 10, pageHeight - 23);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`Campaign Progress: ${completedCount} of ${creators.length} creator deliverables completed`, left, summaryY);

    const filename = `Running_${projectDetail?.code ?? projectDetail?.name ?? "Project"}`
      .replace(/[^a-z0-9_-]+/gi, "_");
    doc.save(`${filename}.pdf`);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-7">
      <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Campaign Running</h2>
      <p className="text-sm text-slate-700">
        Data From Creator
      </p>

      {/* The Running Start field is removed here */}

      <CreatorTable
        creators={creators}
        handleSort={handleSort}
        getSortIcon={getSortIcon}
        onEdit={readOnly ? undefined : (creatorId) => {
          const creatorToUpdate = creators.find(c => c.drf_id === creatorId);
          if (creatorToUpdate) handleUpdateRunningContent(creatorToUpdate, 'edit');
        }}
        showView
        onView={(creator) => handleUpdateRunningContent(creator, "view")}
        checkedCreators={checkedCreators}
        runningMode
        invalidRunningFields={invalidRunningFields}
      />

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
        <button
          onClick={handleExportToPdf}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold transition hover:bg-slate-50 sm:w-auto"
        >
          <FileDocumentIcon className="h-4 w-4" />
          Download PDF
        </button>

        {!readOnly && (
          <button
            onClick={handleGenerateReport}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-6 py-3 text-sm font-semibold text-white sm:w-auto"
          >
            <FileDocumentIcon className="h-4 w-4" />
            Generate Report
          </button>
        )}
      </div>
    </section>
  );
}
