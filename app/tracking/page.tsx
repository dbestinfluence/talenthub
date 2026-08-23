"use client";

import { useEffect, useState } from "react";
import DefaultLayout from "@/components/Layout/DefaultLayout";
import Link from "next/link";
import { confirmDelete, showSuccess } from "@/lib/alert";
import TrackingStepIcon from "@/components/icons/TrackingStepIcon";

const getStepIndex = (status: string) =>
  steps.findIndex(
    (item) =>
      item.label.toLowerCase() === status.toLowerCase()
  );

const steps = [
  { label: "Draft", href: "/tracking/detail" },
  { label: "Quotation", href: "/tracking/detail" },
  { label: "Running", href: "/tracking/detail" },
  { label: "Report", href: "/tracking/detail" },
  { label: "Invoice", href: "/tracking/detail" },
] 

type Project = {
  id: number;
  code: string;
  name: string;
  brandId: number;
  brand: string;
  date: string;
  projectDate: string;
  status: string;
};

type Brand = {
  id: number;
  name: string;
};

export default function TrackingPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const statuses = Array.from(
    new Set(projects.map((item) => item.status))
  );
  
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
  loadData();
}, []);

const loadData = async () => {
  setLoading(true);
  setLoadError("");
  try {
    const res = await fetch("/api/tracking", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error ?? "Failed to fetch project data");
    }

    setProjects(Array.isArray(data.projects) ? data.projects : []);
    setBrands(Array.isArray(data.brands) ? data.brands : []);
  } catch (err) {
    console.error(err);
    setLoadError(err instanceof Error ? err.message : "Failed to fetch project data");
  } finally {
    setLoading(false);
  }
};

  const filteredProjects = projects.filter((project) => {
  const brandMatch =
    !selectedBrand || project.brand === selectedBrand;

  const statusMatch =
    !selectedStatus || project.status === selectedStatus;

const startMatch =
  !startDate ||
  new Date(project.projectDate) >= new Date(startDate);

const endMatch =
  !endDate ||
  new Date(project.projectDate) <= new Date(endDate);

  return (
    brandMatch &&
    statusMatch &&
    startMatch &&
    endMatch
  );
});

    const summary = {
      Draft: filteredProjects.filter(
        (p) => p.status === "Draft"
      ).length,

      Quotation: filteredProjects.filter(
        (p) => p.status === "Quotation"
      ).length,

      Running: filteredProjects.filter(
        (p) => p.status === "Running"
      ).length,

      Report: filteredProjects.filter(
        (p) => p.status === "Report"
      ).length,

      Invoice: filteredProjects.filter(
        (p) => p.status === "Invoice"
      ).length,
    };

const handleDelete = async (projectId: number) => {
  const result = await confirmDelete("Delete Project?");

  if (!result.isConfirmed) return;

  await fetch(`/api/tracking?id=${projectId}`, {
    method: "DELETE",
  });

  await showSuccess(
    "Success",
    "Project has been deleted."
  );

  loadData();
};

  return (
    <DefaultLayout>
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <p className="text-xs font-bold tracking-[0.35em] text-sky-600">
            PROGRESS
          </p>

          <div className="mt-3 grid gap-6 lg:grid-cols-[1.2fr_3fr]">
            <div>
              <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                Project Progress
              </h1>
              <p className="mt-4 max-w-xs text-sm text-slate-500">
                Monitor every campaign stage from draft to finish.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <DateFilterBox
                label="Start Date"
                value={startDate}
                onChange={setStartDate}
              />
              <DateFilterBox
                label="End Date"
                value={endDate}
                onChange={setEndDate}
              />
            <SelectBox
              label="Brand"
              placeholder="Select Brand"
              options={brands.map((item) => item.name)}
              value={selectedBrand}
              onChange={setSelectedBrand}
            />

            <SelectBox
              label="Status"
              placeholder="Select Status"
              options={statuses}
              value={selectedStatus}
              onChange={setSelectedStatus}
            />
            </div>
          </div>
        </section>

      {loadError ? (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <span>Project data is temporarily unavailable. The Progress page remains available with empty data. {loadError}</span>
          <button type="button" onClick={() => void loadData()} className="shrink-0 rounded-lg bg-amber-900 px-4 py-2 text-xs font-semibold text-white">Try Again</button>
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      <SummaryCard
        title="DRAFT"
        value={summary.Draft.toString()}
        color="text-orange-600"
      />

      <SummaryCard
        title="QUOTATION"
        value={summary.Quotation.toString()}
        color="text-blue-600"
      />

      <SummaryCard
        title="RUNNING"
        value={summary.Running.toString()}
        color="text-emerald-600"
      />

      <SummaryCard
        title="REPORT"
        value={summary.Report.toString()}
        color="text-purple-600"
      />

      <SummaryCard
        title="INVOICE"
        value={summary.Invoice.toString()}
        color="text-amber-700"
      />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      {[...filteredProjects].sort((a, b) =>
        Number(b.status === "Draft") - Number(a.status === "Draft") ||
        new Date(b.date).getTime() - new Date(a.date).getTime()
      ).map((project) => {
        const stepIndex = getStepIndex(project.status);

        return (
          <ProjectCard
            key={project.id}
            project={project}
            stepIndex={stepIndex}
            onDelete={handleDelete}
          />
        );
      })}
      {!loading && filteredProjects.length === 0 ? (
        <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="font-semibold text-slate-700">No project data available.</p>
          <p className="mt-2 text-sm text-slate-500">Create a project from Creator Discovery or adjust the selected filters.</p>
        </div>
      ) : null}
      {loading && projects.length === 0 ? (
        <div className="col-span-full rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">Loading project data...</div>
      ) : null}
      </section>
      </div>
    </DefaultLayout>
  )
}

function DateFilterBox({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-700">
        {label}
      </label>

      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-600 outline-none focus:border-sky-400"
      />
    </div>
  );
}

function SelectBox({
  label,
  placeholder,
  options,
  value,
  onChange,
}: {
  label: string
  placeholder: string
  options: string[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-700">
        {label}
      </label>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-600 outline-none focus:border-sky-400"
      >
        <option value="">
          {placeholder}
        </option>

        {options.map((item) => (
          <option
            key={item}
            value={item}
          >
            {item}
          </option>
        ))}
      </select>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  color,
}: {
  title: string
  value: string
  color: string
}) {
  return (
    <div className="h-full min-h-[120px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold tracking-[0.35em] text-slate-500">
        {title}
      </p>
      <p className={`mt-3 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function ProjectCard({
  project,
  stepIndex,
  onDelete,
}: {
  project: Project;
  stepIndex: number;
  onDelete: (projectId: number) => Promise<void>;
}) {

const statusColors = {
  Draft: {
    border: "border-orange-300",
    text: "text-orange-600",
    badge: "border-orange-300 bg-orange-50 text-orange-600",
  },

  Quotation: {
    border: "border-blue-300",
    text: "text-blue-600",
    badge: "border-blue-300 bg-blue-50 text-blue-600",
  },

  Running: {
    border: "border-emerald-300",
    text: "text-emerald-600",
    badge: "border-emerald-300 bg-emerald-50 text-emerald-600",
  },

  Report: {
    border: "border-purple-300",
    text: "text-purple-600",
    badge: "border-purple-300 bg-purple-50 text-purple-600",
  },

  Invoice: {
    border: "border-amber-300",
    text: "text-amber-700",
    badge: "border-amber-300 bg-amber-50 text-amber-700",
  },
};

const currentColor =
  statusColors[project.status as keyof typeof statusColors] ??
  statusColors.Draft;

const stepStyles = {
  Draft:
    "border-orange-300 bg-orange-50 text-orange-600",

  Quotation:
    "border-blue-300 bg-blue-50 text-blue-600",

  Running:
    "border-emerald-300 bg-emerald-50 text-emerald-600",

  Report:
    "border-purple-300 bg-purple-50 text-purple-600",

  Invoice:
    "border-amber-300 bg-amber-50 text-amber-700",
};

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <button
      onClick={() => onDelete(project.id)}
      className="rounded-lg border border-red-300 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600"
    >
      🗑 Delete
    </button>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div>
          <p className="text-sm font-bold text-slate-900">{project.code}</p>
          <span
            className={`mt-3 inline-flex rounded-full border px-5 py-1 text-xs font-semibold ${currentColor.badge}`}
          >
            {project.status}
          </span>
          <p className="mt-5 text-xs text-slate-500">
          {project.date
            ? `${new Date(project.date).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })} • ${new Date(project.date).toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}`
            : "-"} 
        </p>
        </div>

        <InfoBox
          title="PROJECT NAME"
          value={project.name}
        />
        <InfoBox
          title="BRAND"
          value={project.brand}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="grid grid-cols-5 gap-1 sm:gap-2">
          {steps.map((step, index) => {
          const active = index === stepIndex;
            const completed = index < stepIndex;
            const stepClassName = `rounded-xl border p-3 transition ${
              active
                ? `${stepStyles[step.label as keyof typeof stepStyles]} hover:-translate-y-0.5 hover:shadow-sm`
                : completed
                  ? "border-slate-200 bg-white hover:-translate-y-0.5 hover:shadow-sm"
                  : "cursor-not-allowed border-slate-200 bg-white opacity-60"
            }`;

          const stepContent = (
            <div className="flex flex-col items-center text-center">
              <div
                className={`mb-2 flex h-10 w-10 items-center justify-center rounded-xl border ${
                  active
                    ? stepStyles[step.label as keyof typeof stepStyles]
                    : "border-slate-300 bg-white"
                }`}
              >
                <TrackingStepIcon
                  step={step.label}
                  className="h-7 w-7"
                  active={active}
                />
              </div>
              <p className="text-[8px] font-bold tracking-widest text-slate-500 sm:text-[9px]">
                STEP
              </p>
              <p className="text-[10px] font-bold text-slate-800 sm:text-[11px]">
                {step.label}
              </p>
            </div>
          );

          if (active || completed) {
            return (
              <Link
                key={step.label}
                href={`${step.href}?projectId=${project.id}&view=${step.label}`}
                className={stepClassName}
                title={
                  active
                    ? `Open ${step.label} stage`
                    : `View ${step.label} history`
                }
              >
                {stepContent}
              </Link>
            );
          }

          return (
            <div
              key={step.label}
              className={stepClassName}
              aria-disabled="true"
              title={
                completed
                  ? "This stage is complete"
                  : "This stage is not available yet"
              }
            >
              {stepContent}
            </div>
          );
          })}
        </div>

        <div className="relative mt-5 h-2 rounded-full bg-slate-200">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-orange-400 via-emerald-400 to-sky-400"
            style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
          />
          <div
            className="absolute top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl border border-sky-200 bg-white text-sm shadow"
            style={{
              left: `clamp(0px, calc(${((stepIndex + 1) / steps.length) * 100}% - 16px), calc(100% - 32px))`
            }}
          >
            <span className="-scale-x-100">🚶</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoBox({ title, value }: { title: string; value: string }) {
  return (
    <div className="min-h-20 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <p className="text-[10px] font-bold tracking-[0.25em] text-slate-500">
        {title}
      </p>
      <p className="mt-2 text-sm font-bold text-slate-900">{value}</p>
    </div>
  )
}
