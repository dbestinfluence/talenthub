"use client";

import {
  confirmStartProject,
  showSuccess,
} from "@/lib/alert";
import { useRouter } from "next/navigation";
import { useState } from "react";
import DefaultLayout from "@/components/Layout/DefaultLayout"
import FileDocumentIcon from "@/components/icons/FileDocumentIcon";

const projectDetail = {
  brand: "CAFE PRO",
  projectName: "NEW YEAR 2",
  pic: "Gumelar Akhirul",
  date: "24 May 2026",
};

const creators = [
  ["1", "William Tanuwijaya", "@williamtanu", "3.1M+", "1", "3.1%", "150K", "150K", "150K", "45.000.000"],
  ["2", "Raymond Chin", "@raymondchins", "2.3M+", "1", "4.5%", "250K", "250K", "250K", "55.000.000"],
  ["3", "Andrew Darwis", "@adarwis", "550K+", "1", "2.3%", "70K", "70K", "70K", "25.000.000"],
  ["4", "Fadil Jaidi", "@fadiljaidi", "1.6M+", "1", "1.6%", "350K", "350K", "350K", "85.000.000"],
  ["5", "Merry Riana", "@merryriana", "4.6M+", "1", "2.8%", "500K", "500K", "500K", "110.000.000"],
]

const steps = ["Draft", "Quotation", "Running", "Report", "Invoice", "Finish"]

export default function QuotationPage() {

  const [sortField, setSortField] = useState("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [creatorData, setCreatorData] = useState(creators);
  const router = useRouter();

  const currentStep = 1;

const progressWidth =
  currentStep === 1
    ? "22%"
    : `${(currentStep / (steps.length - 1)) * 100}%`;

const stepDates = [
  "17 May 2026", // Draft
  "20 May 2026", // Quotation
  "-",           // Running
  "-",           // Report
  "-",           // Invoice
  "-",           // Finish
];

  const handleSort = (columnIndex: number, field: string) => {
  const direction =
    sortField === field && sortDirection === "asc"
      ? "desc"
      : "asc";

  setSortField(field);
  setSortDirection(direction);

  const sorted = [...creatorData].sort((a, b) => {
    const aValue = a[columnIndex];
    const bValue = b[columnIndex];

    return direction === "asc"
      ? String(aValue).localeCompare(String(bValue))
      : String(bValue).localeCompare(String(aValue));
  });

  setCreatorData(sorted);
};

const getSortIcon = (field: string) => {
  if (sortField !== field) return "↕";
  return sortDirection === "asc" ? "▲" : "▼";
};

const handleStartProject = async () => {
  const result = await confirmStartProject();

  if (!result.isConfirmed) return;

  await showSuccess(
    "Success",
    "Project has moved to the Running stage."
  );

  router.push("/tracking/running");
};

  return (
    <DefaultLayout>
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-7">
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Detail Project</h1>

        <span className="mt-4 inline-flex rounded-full border border-emerald-300 bg-emerald-50 px-6 py-2 text-sm font-semibold text-emerald-600">
          Quotation
        </span>

          <div className="-mx-4 mt-8 overflow-x-auto px-4 touch-pan-x sm:mx-0 sm:mt-12 sm:px-0">
            <div className="relative min-w-[720px] px-4 sm:min-w-[1000px] sm:px-8">

              {/* Base Line */}
              <div className="absolute left-14 right-14 top-3 h-1 rounded-full bg-slate-300" />

              {/* Progress Line */}
              <div
                className="absolute left-14 top-3 h-1 bg-emerald-500"
                style={{
                  width: "20%",
                }}
              />

              <div className="relative flex justify-between">
                {steps.map((step, index) => {
                  const completed = index < currentStep;
                  const active = index === currentStep;

                  return (
                    <div
                      key={step}
                      className="flex w-28 flex-col items-center"
                    >
                    <div
                      className={`h-8 w-8 rounded-full border-4 ${
                        completed
                          ? "border-emerald-500 bg-emerald-500"
                          : active
                          ? "border-orange-500 bg-orange-500"
                          : "border-slate-300 bg-white"
                      }`}
                    />

                      <p
                        className={`mt-3 text-sm font-semibold ${
                          completed || active
                            ? "text-slate-900"
                            : "text-slate-500"
                        }`}
                      >
                        {step}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {stepDates[index]}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:mt-16 sm:grid-cols-2 xl:grid-cols-4">
          <FieldBox
            label="Brand Name"
            value={projectDetail.brand}
          />

          <FieldBox
            label="Project Name"
            value={projectDetail.projectName}
          />

          <FieldBox
            label="PIC"
            value={projectDetail.pic}
          />

          <FieldBox
            label="Date"
            value={projectDetail.date}
          />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          <h2 className="text-2xl font-bold text-slate-900">List Creator</h2>

          <div className="mt-8 flex items-center gap-2 text-xs">
            <span>Show</span>
            <input defaultValue="10" className="h-10 w-16 border border-slate-300 px-3" />
            <span>entries</span>
          </div>

          <div className="mt-6 w-full overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-[1300px] w-full border-collapse whitespace-nowrap text-sm">
            <thead>
              <tr>
                {[
                  { label: "No.", index: 0, field: "no" },
                  { label: "Photo", index: -1, field: "" },
                  { label: "Influencer Name", index: 1, field: "name" },
                  { label: "Username", index: 2, field: "username" },
                  { label: "Followers", index: 3, field: "followers" },
                  { label: "Qty", index: 4, field: "qty" },
                  { label: "ER (%)", index: 5, field: "er" },
                  { label: "Avr View", index: 6, field: "avrView" },
                  { label: "Avr Brand", index: 7, field: "avrBrand" },
                  { label: "View", index: 8, field: "view" },
                  { label: "Rate Card", index: 9, field: "rate" },
                ].map((head) => (
                  <th
                    key={head.label}
                    onClick={() =>
                      head.index >= 0 &&
                      handleSort(head.index, head.field)
                    }
                    className={`border border-slate-200 px-4 py-4 text-left text-xs font-bold ${
                      head.index >= 0
                        ? "cursor-pointer hover:bg-slate-50"
                        : ""
                    }`}
                  >
                    {head.label}

                    {head.index >= 0 && (
                      <span className="ml-1 text-slate-400">
                        {getSortIcon(head.field)}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>

              <tbody>
                {creatorData.map((row) => (
                  <tr key={row[0]}>
                    <td className="border border-slate-200 px-4 py-4 text-center">{row[0]}</td>
                    <td className="border border-slate-200 px-4 py-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 text-white">
                        🖼️
                      </div>
                    </td>
                    {row.slice(1).map((item, index) => (
                      <td key={index} className="border border-slate-200 px-4 py-4">
                        {item}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-slate-700">Showing 1 to 5 of 5 entries</p>

          <hr className="my-6 border-slate-300" />

          <div className="flex justify-end">
            <div className="w-full max-w-xl rounded-xl border border-yellow-200 bg-yellow-50 p-6">
              <div className="space-y-2 text-sm">
                <TotalRow label="Subtotal" value="Rp 320,000,000" />
                <TotalRow label="DPP" value="Rp 320,000,000" />
                <TotalRow label="PPN (11%)" value="Rp 35,200,000" />
              </div>

              <div className="mt-6 flex justify-between text-lg font-bold">
                <span>Grand Total</span>
                <span>Rp 355,200,000</span>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
            <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-8 py-3 text-sm font-semibold md:w-auto">
              <FileDocumentIcon className="h-4 w-4" />
              Export PDF
            </button>
          <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-8 py-3 text-sm font-semibold md:w-auto">
            <FileDocumentIcon className="h-4 w-4" />
            Send PDF
          </button>
          <button
            onClick={handleStartProject}
            className="w-full rounded-xl bg-black px-8 py-3 text-center text-sm font-semibold text-white md:w-auto"
          >
            Start Project
          </button>
          </div>
        </section>
      </div>
    </DefaultLayout>
  )
}

function FieldBox({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="text-lg font-semibold text-slate-400">{label}</label>
      <input
        value={value}
        readOnly
        className="mt-3 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none"
      />
    </div>
  )
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  )
}
