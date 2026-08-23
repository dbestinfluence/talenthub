"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  confirmDelete,
  confirmGenerateQuotation,
  confirmGenerateReport,
  confirmGenerateInvoice,
  confirmFinishProject,
  confirmStartProject,
  showAlertValidationError,
  showRunningContentModal,
  showSuccess,
} from "@/lib/alert";

import DefaultLayout from "@/components/Layout/DefaultLayout";

import DraftSection from "@/components/tracking/DraftSection";
import QuotationSection from "@/components/tracking/QuotationSection";
import RunningSection from "@/components/tracking/RunningSection";
import ReportSection from "@/components/tracking/ReportSection";
import InvoiceSection from "@/components/tracking/InvoiceSection";


export default function DraftPage() {
  const [isClientReady, setIsClientReady] = useState(false);
  const [projectDetail, setProjectDetail] = useState<any>(null);
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const requestedView = searchParams.get("view");

  const steps = [
  {
    label: "Draft",
    date: projectDetail?.draftStartDate,
  },
  {
    label: "Quotation",
    date: projectDetail?.quotationStartDate,
  },
  {
    label: "Running",
    date: projectDetail?.runningStartDate,
  },
  {
    label: "Report",
    date: projectDetail?.reportStartDate,
  },
  {
    label: "Invoice",
    date: projectDetail?.invoiceStartDate,
  },
  {
    label: "Finish",
    date: projectDetail?.finishDate,
  },
];

  const [creators, setCreators] = useState<any[]>([]);
  const [sowOptions, setSowOptions] = useState<
    { sow_id: number; sow_nama: string | null }[]
  >([]);
  const [invalidSowCreatorIds, setInvalidSowCreatorIds] = useState<number[]>([]);
  const [invalidPricingFields, setInvalidPricingFields] = useState<Record<number, {
    rateCard: boolean;
    markupPrice: boolean;
    qty: boolean;
  }>>({});
  const [invalidRunningFields, setInvalidRunningFields] = useState<Record<number, {
    planningUpload: boolean;
    actualUpload: boolean;
    linkContent: boolean;
  }>>({});
  const [sortField, setSortField] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [checkedCreators, setCheckedCreators] = useState<number[]>([]);
  const router = useRouter();

  useEffect(() => {
    setIsClientReady(true);
  }, []);

  const loadProject = async () => {
  const res = await fetch(`/api/tracking?id=${projectId}`, {
    cache: "no-store",
  });
  const data = await res.json();

  setProjectDetail((prev: any) => ({
    ...prev,
    ...data,
  }));
};

const loadCreators = async () => {
  try {
    const res = await fetch(`/api/tracking/detail?projectId=${projectId}`);

    if (!res.ok) {
      // Jika respons tidak OK (misal: 500 Internal Server Error), lempar galat
      throw new Error(`Failed to fetch creators: ${res.statusText}`);
    }

    const data = await res.json();

    const loadedCreators = data.creators || [];
    setCreators(loadedCreators); // Pastikan creators adalah array

    // Set creator yang sudah punya link content sebagai "checked"
    const alreadyChecked = loadedCreators.filter((c: any) => c.drf_link_content).map((c: any) => c.drf_id);
    setCheckedCreators(alreadyChecked);

    setProjectDetail((prev: any) => ({
      ...prev,
      subtotal: data.subtotal,
      dpp: data.dpp,
      ppn: data.ppn,
      grandTotal: data.grandTotal,
      taxRate: data.taxRate,
    }));
  } catch (error) {
    console.error("Error loading creators:", error);
    setCreators([]); // Atur ke array kosong jika terjadi galat
  }
};

const loadSows = async () => {
  try {
    const res = await fetch("/api/sow", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch SOW");
    setSowOptions(await res.json());
  } catch (error) {
    console.error("Error loading SOW:", error);
    setSowOptions([]);
  }
};

useEffect(() => {
  if (!projectId) return;
  loadProject();
  loadCreators();
  loadSows();
}, [projectId]);

const handleSowChange = async (creatorId: number, sowId: number | null) => {
  try {
    const res = await fetch(`/api/tracking/detail?id=${creatorId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ drf_sow: sowId }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Failed to update SOW");
    }

    const selectedSow = sowOptions.find((sow) => sow.sow_id === sowId);
    setCreators((current) =>
      current.map((creator) =>
        creator.drf_id === creatorId
          ? { ...creator, sowId, sow: selectedSow?.sow_nama ?? null }
          : creator
      )
    );
    setInvalidSowCreatorIds((current) =>
      current.filter((id) => id !== creatorId)
    );
  } catch (error) {
    console.error("Error updating SOW:", error);
    await loadCreators();
  }
};

const handleDraftPriceChange = async (
  creatorId: number,
  field: "rateCard" | "markupPrice" | "qty",
  value: number | null
) => {
  const isInvalid = value === null || !Number.isFinite(value) || value <= 0;
  setInvalidPricingFields((current) => ({
    ...current,
    [creatorId]: {
      rateCard: field === "rateCard" ? isInvalid : current[creatorId]?.rateCard ?? false,
      markupPrice: field === "markupPrice" ? isInvalid : current[creatorId]?.markupPrice ?? false,
      qty: field === "qty" ? isInvalid : current[creatorId]?.qty ?? false,
    },
  }));

  if (isInvalid) {
    setCreators((current) => current.map((creator) => {
      if (creator.drf_id !== creatorId) return creator;
      const updated = { ...creator, [field]: null };
      if (field === "markupPrice") {
        updated.rate = 0;
        updated.total = 0;
      } else if (field === "qty") {
        updated.drf_qty = 0;
        updated.qty = 0;
        updated.total = 0;
      }
      return updated;
    }));
  }

  try {
    const databaseField = field === "rateCard"
      ? "drf_rate"
      : field === "markupPrice" ? "drf_markup_price" : "drf_qty";
    const response = await fetch(`/api/tracking/detail?id=${creatorId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [databaseField]: value }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Failed to save pricing");

    setCreators((current) => current.map((creator) => {
      if (creator.drf_id !== creatorId) return creator;
      const updated = { ...creator, [field]: value };
      if (field === "markupPrice") {
        updated.rate = value ?? 0;
        updated.total = Number(value ?? 0) * Number(creator.drf_qty ?? creator.qty ?? 1);
      } else if (field === "qty") {
        updated.drf_qty = value ?? 0;
        updated.qty = value ?? 0;
        updated.total = Number(value ?? 0) * Number(creator.markupPrice ?? 0);
      }
      return updated;
    }));
  } catch (error) {
    await showAlertValidationError(
      error instanceof Error ? error.message : "Failed to save pricing."
    );
    await loadCreators();
  }
};

const handleAddSow = async (creatorId: number) => {
  try {
    const response = await fetch("/api/tracking/detail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceDetailId: creatorId }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Failed to add SOW row");
    await loadCreators();
  } catch (error) {
    await showAlertValidationError(
      error instanceof Error ? error.message : "Failed to add SOW row."
    );
  }
};

  const handleEditDraft = () => {
  router.push(`/discovery?projectId=${projectId}&mode=edit`);
};

const handleGenerateQuotation = async () => {
  const creatorsWithoutSow = creators.filter((creator) => !creator.sowId);
  const pricingValidation = creators.reduce<Record<number, {
    rateCard: boolean;
    markupPrice: boolean;
    qty: boolean;
  }>>((result, creator) => {
    const fields = {
      rateCard: !Number.isFinite(Number(creator.rateCard)) || Number(creator.rateCard) <= 0,
      markupPrice: !Number.isFinite(Number(creator.markupPrice)) || Number(creator.markupPrice) <= 0,
      qty: !Number.isInteger(Number(creator.drf_qty)) || Number(creator.drf_qty) <= 0,
    };
    if (fields.rateCard || fields.markupPrice || fields.qty) result[creator.drf_id] = fields;
    return result;
  }, {});

  setInvalidPricingFields(pricingValidation);

  if (creatorsWithoutSow.length > 0 || Object.keys(pricingValidation).length > 0) {
    setInvalidSowCreatorIds(creatorsWithoutSow.map((creator) => creator.drf_id));
    await showAlertValidationError(
      "Complete the SOW, Rate Card, Mark Price, and Qty for every creator before generating the quotation."
    );
    return;
  }

  setInvalidSowCreatorIds([]);
  setInvalidPricingFields({});
  const result = await confirmGenerateQuotation();

  if (!result.isConfirmed) return;

  const res = await fetch(`/api/tracking?id=${projectId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prj_status: 2,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    setInvalidSowCreatorIds(err.missingSowCreatorIds ?? []);
    setInvalidPricingFields(err.missingPricingFields ?? {});
    await showAlertValidationError(
      err.error ?? "Complete the SOW for every creator before generating the quotation."
    );
    return;
  }

  await loadProject();
  await loadCreators();

  await showSuccess(
    "Success",
    "Quotation has been generated successfully."
  );

  router.push(`/tracking/detail?projectId=${projectId}&view=Quotation`);
};

const handleStartProject = async (taxRate: number) => {
  const result = await confirmStartProject();

  if (!result.isConfirmed) return;

  const res = await fetch(`/api/tracking?id=${projectId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prj_status: 3, // 3 = Running
      prj_tax_rate: taxRate,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    console.log(err);
    return;
  }

  await loadProject();
  await loadCreators();

  await showSuccess(
    "Success",
    "The project has been started."
  );

  router.push(`/tracking/detail?projectId=${projectId}&view=Running`);
};

const handleGenerateReport = async () => {
  const missingFields = creators.reduce<Record<number, {
    planningUpload: boolean;
    actualUpload: boolean;
    linkContent: boolean;
  }>>((result, creator) => {
    const fields = {
      planningUpload: !creator.drf_planning_upload,
      actualUpload: !creator.drf_actual_upload,
      linkContent: !creator.drf_link_content?.trim(),
    };

    if (fields.planningUpload || fields.actualUpload || fields.linkContent) {
      result[creator.drf_id] = fields;
    }

    return result;
  }, {});

  if (Object.keys(missingFields).length > 0) {
    setInvalidRunningFields(missingFields);
    await showAlertValidationError(
      "Complete Planning Upload, Actual Upload, and Link Content for every creator before generating the report."
    );
    return;
  }

  setInvalidRunningFields({});
  const result = await confirmGenerateReport();
  if (!result.isConfirmed) return;

  const res = await fetch(`/api/tracking?id=${projectId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prj_status: 4 }),
  });

  if (!res.ok) {
    const err = await res.json();
    if (err.missingRunningFields) {
      setInvalidRunningFields(err.missingRunningFields);
    }
    await showAlertValidationError(
      err.error ?? "Complete all Running data before generating the report."
    );
    console.error(err);
    return;
  }

  await loadProject();
  await showSuccess("Success", "Report has been generated successfully.");
  router.push(`/tracking/detail?projectId=${projectId}&view=Report`);
};

const handleGenerateInvoice = async () => {
  let payments: { pyt_id: number; pyt_bank: string | null; pyt_norek: string | null; pyt_nama: string | null }[] = [];

  try {
    const paymentResponse = await fetch("/api/payment", { cache: "no-store" });
    if (!paymentResponse.ok) {
      throw new Error("Failed to load payment accounts.");
    }
    payments = await paymentResponse.json();
    if (payments.length === 0) {
      throw new Error("No active payment accounts are available. Add one in Master Data Payment first.");
    }
  } catch (error) {
    await showAlertValidationError(
      error instanceof Error ? error.message : "Failed to load payment accounts."
    );
    return;
  }

  const bankDetails = await confirmGenerateInvoice(payments);

  // Stop when the user closes the modal or leaves a required field empty.
  if (!bankDetails) {
    return;
  }

  const res = await fetch(`/api/tracking?id=${projectId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prj_status: 5, // 5 = Invoice
      ...bankDetails,
    }),
  });

  if (!res.ok) {
    const responseText = await res.text();
    let message = "Failed to generate invoice.";

    try {
      const errorData = JSON.parse(responseText);
      message = errorData.error ?? message;
    } catch {
      message = responseText || message;
    }

    await showAlertValidationError(message);
    console.error(`Generate Invoice failed (${res.status}): ${message}`);
    return;
  }

  await loadProject();
  await loadCreators();
  await showSuccess("Success", "Invoice has been generated successfully.");
  router.push(`/tracking/detail?projectId=${projectId}&view=Invoice`);
};

const handleFinishProject = async () => {
  const result = await confirmFinishProject();
  if (!result.isConfirmed) return;

  const res = await fetch(`/api/tracking?id=${projectId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prj_ienddate: new Date().toISOString() }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    await showAlertValidationError(errorData.error ?? "Failed to complete the project.");
    return;
  }

  await loadProject();
  await showSuccess("Success", "Project has been completed successfully.");
  router.push(`/tracking/detail?projectId=${projectId}&view=Finish`);
};


const handleUpdateRunningContent = async (creator: any, mode: "edit" | "view") => {
  // Helper to format date string to YYYY-MM-DD, handles null/undefined
  const formatDateForInput = (dateStr: string | null | undefined) => {
    return dateStr ? new Date(dateStr).toISOString().split('T')[0] : "";
  };

  const result: any = await showRunningContentModal({
    id: creator.drf_id,
    name: creator.name,
    planning_upload: formatDateForInput(creator.drf_planning_upload),
    actual_upload: formatDateForInput(creator.drf_actual_upload),
    link_content: creator.drf_link_content ?? "",
    start_project_date: formatDateForInput(projectDetail?.runningStartDate),
  }, mode);

  // Jika user menutup modal atau dalam mode view, jangan lakukan apa-apa
  if (!result || mode === 'view') return;

  try {
    const params = new URLSearchParams({ id: creator.drf_id.toString() });
    const response = await fetch(`/api/tracking/detail?${params.toString()}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        drf_planning_upload: result.planning_upload,
        drf_actual_upload: result.actual_upload,
        drf_link_content: result.link_content,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let message = errorText || `Request failed with status ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        message = errorData.error || "Failed to update data";
      } catch { /* use the raw response text */ }
      throw new Error(message);
    }

    const updatedCreator = await response.json();

    // Update state creators dengan data baru
    setCreators((prevData) =>
      prevData.map((c) => (c.drf_id === updatedCreator.drf_id ? { ...c, ...updatedCreator } : c))
    );
    setInvalidRunningFields((current) => {
      const fields = {
        planningUpload: !result.planning_upload,
        actualUpload: !result.actual_upload,
        linkContent: !result.link_content?.trim(),
      };

      if (!fields.planningUpload && !fields.actualUpload && !fields.linkContent) {
        const remaining = { ...current };
        delete remaining[creator.drf_id];
        return remaining;
      }

      return { ...current, [creator.drf_id]: fields };
    });

    // Tambahkan id creator ke `checkedCreators` agar ikonnya berubah jadi mata
    if (result.link_content) {
      setCheckedCreators((prev) => [...new Set([...prev, creator.drf_id])]);
    }

    await showSuccess("Success", "Content data has been updated successfully.");
  } catch (error) {
    console.error("Error updating running content:", error);
    await showAlertValidationError(
      error instanceof Error ? error.message : "Failed to update running content."
    );
  }
};

const handleDelete = async (id: number) => {
  const result = await confirmDelete(
    "Delete Creator?",
  );

  if (!result.isConfirmed) return;

  try {
    const res = await fetch(`/api/tracking/detail?id=${id}`, {
      method: "DELETE",
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error);
    }

    await loadCreators();

    await showSuccess(
      "Success",
      "Creator has been successfully removed from the project."
    );
  } catch (err) {
    console.error(err);
  }
};

  const handleSort = (field: string) => {
    const direction =
      sortField === field && sortDirection === "asc" ? "desc" : "asc";

    setSortField(field);
    setSortDirection(direction);

    const sorted = [...creators].sort((a: any, b: any) => {
      // Use a safe getter for potentially nested or missing properties
      const get = (obj: any, path: string) => path.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);
      const aValue = get(a, field);
      const bValue = get(b, field);

      if (aValue == null || bValue == null) return 0;

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return direction === "asc"
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });

    setCreators(sorted);
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return "↕"; // This is a symbol, no translation needed.
    return sortDirection === "asc" ? "▲" : "▼";
  };

const statusIndex: Record<string, number> = {
  Draft: 0,
  Quotation: 1,
  Running: 2,
  Report: 3,
  Invoice: 4,
  Finish: 5,
};

const isProjectFinished = Boolean(projectDetail?.invoiceEndDate);
const currentStep = isProjectFinished
  ? statusIndex.Finish
  : statusIndex[projectDetail?.status ?? "Draft"] ?? 0;

const canViewRequestedStep =
  requestedView !== null &&
  Object.prototype.hasOwnProperty.call(statusIndex, requestedView) &&
  statusIndex[requestedView] <= currentStep;
const viewedStatus = canViewRequestedStep
  ? requestedView
  : projectDetail?.status;
const isHistoricalView = viewedStatus !== projectDetail?.status;

const renderTrackingSection = () => {
  switch (viewedStatus) {
    case "Draft":
      return (
        <DraftSection
          creators={creators}
          projectDetail={projectDetail}
          handleDelete={handleDelete}
          handleEditDraft={handleEditDraft}
          handleGenerateQuotation={handleGenerateQuotation}
          handleSort={handleSort}
          getSortIcon={getSortIcon}
          showView={true}
          onView={(creator) => handleUpdateRunningContent(creator, "view")}
          sowOptions={sowOptions}
          onSowChange={handleSowChange}
          invalidSowCreatorIds={invalidSowCreatorIds}
          onDraftPriceChange={handleDraftPriceChange}
          invalidPricingFields={invalidPricingFields}
          onAddSow={handleAddSow}
          readOnly={isHistoricalView}
        />
      );

case "Quotation":
  return (
    <QuotationSection
      creators={creators}
      projectDetail={projectDetail}
      handleSort={handleSort}
      getSortIcon={getSortIcon}
      showView={true}
      onView={(creator) => handleUpdateRunningContent(creator, "view")}
      handleStartProject={handleStartProject}
      readOnly={isHistoricalView}
    />
  );

    case "Running":
      return (
        <RunningSection
          creators={creators}
          projectDetail={projectDetail}
          checkedCreators={checkedCreators}
          handleSort={handleSort}
          getSortIcon={getSortIcon}
          handleUpdateRunningContent={handleUpdateRunningContent}
          handleGenerateReport={handleGenerateReport}
          readOnly={isHistoricalView}
          invalidRunningFields={invalidRunningFields}
        />
      );

    case "Report":
      return (
        <ReportSection
          projectDetail={projectDetail}
          creators={creators}
          handleSort={handleSort}
          getSortIcon={getSortIcon}
          handleGenerateInvoice={handleGenerateInvoice}
          readOnly={isHistoricalView}
        />
      );

    case "Invoice":
      return (
        <InvoiceSection
          projectDetail={projectDetail}
          creators={creators}
          handleSort={handleSort}
          getSortIcon={getSortIcon}
          handleFinish={handleFinishProject}
          readOnly={isHistoricalView || isProjectFinished}
        />
      );

    case "Finish":
      return (
        <InvoiceSection
          projectDetail={projectDetail}
          creators={creators}
          handleSort={handleSort}
          getSortIcon={getSortIcon}
          handleFinish={handleFinishProject}
          readOnly
        />
      );

    default:
      return null;
  }
};

  if (!isClientReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-semibold text-slate-600 shadow-sm">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-sky-600" />
          Loading project workspace...
        </div>
      </div>
    );
  }

  return (
    <DefaultLayout>
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:p-7">
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Project Details</h1>

          <span
            className={`mt-4 inline-flex rounded-full border px-6 py-2 text-sm font-semibold ${
              isProjectFinished
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-orange-300 bg-orange-50 text-orange-600"
            }`}
          >
            {projectDetail?.status}
          </span>
          <div className="-mx-4 mt-8 overflow-x-auto px-4 touch-pan-x sm:mx-0 sm:mt-10 sm:px-0">
            <div className="relative min-w-[720px] px-4 sm:min-w-[1000px] sm:px-10">
              <div
                className={`absolute left-0 top-3 h-1 w-[60px] rounded-full ${
                  currentStep > 0 || isProjectFinished
                    ? "bg-emerald-500"
                    : "bg-orange-500"
                }`}
              />

              <div className="relative flex items-start justify-between">
                {steps.map((step, index) => {
                  const completed = index < currentStep || isProjectFinished;
                  const active = index === currentStep && !isProjectFinished;
                  const connectorColor =
                    isProjectFinished || index < currentStep
                      ? "bg-emerald-500"
                      : index === currentStep
                        ? "bg-orange-500"
                        : "bg-slate-300";

                  return (
                    <div key={step.label} className="contents">
                      <div
                        className="relative flex w-[76px] shrink-0 flex-col items-center sm:w-20"
                      >
                        <div
                          className={`relative z-10 h-7 w-7 rounded-full border-4 ${
                            completed
                              ? "border-emerald-500 bg-emerald-500"
                              : active
                                ? "border-orange-500 bg-orange-500"
                                : "border-slate-300 bg-white"
                          }`}
                        />

                        <p className="mt-3 text-center text-xs font-semibold text-slate-900 sm:text-sm">
                          {step.label}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {step.date
                            ? new Date(step.date).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })
                            : "-"}
                        </p>
                      </div>

                      {index < steps.length - 1 && (
                        <div className={`-mx-5 mt-3 h-1 min-w-10 flex-1 rounded-full ${connectorColor}`} />
                      )}
                    </div>
                  );
                })}
              </div>

              <div
                className={`absolute right-0 top-3 h-1 w-[60px] rounded-full ${
                  isProjectFinished ? "bg-emerald-500" : "bg-slate-300"
                }`}
              />
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2 xl:grid-cols-4">
            <FieldBox label="Brand Name" value={projectDetail?.brand} />
            <FieldBox label="Project Name" value={projectDetail?.name} />
            <FieldBox label="PIC" value={projectDetail?.createdBy} />
            <FieldBox
              label="Date"
              value={
                  projectDetail?.createdAt
                      ? new Date(projectDetail.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : ""
              }
          />
          </div>
        </section>
        {renderTrackingSection()}
      </div>
    </DefaultLayout>
  );
}

function FieldBox({
  label,
  value,
}: {
  label: string;
  value?: any;
}) {
  return (
    <div>
      <label className="text-lg font-semibold text-slate-400">{label}</label>
      <input
          value={value ?? ""}
          readOnly
        className="mt-3 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none"
      />
    </div>
  );
}
