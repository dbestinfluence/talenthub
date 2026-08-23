"use client";

import { useState } from "react";
import DefaultLayout from "@/components/Layout/DefaultLayout"
import {
  confirmGenerateInvoice,
  showSuccess,
} from "@/lib/alert";
import { useRouter } from "next/navigation";
import ReportIcon from "@/components/icons/ReportIcon";
import InvoiceIcon from "@/components/icons/InvoiceIcon";

const projectDetail = {
  brand: "CAFE PRO",
  projectName: "NEW YEAR 2",
  pic: "Gumelar Akhirul",
  date: "24 May 2026",
};

const creators = [
  ["1", "Raymond Chin", "@raymondchins", "http://content.ig.com"],
  ["2", "Andrew Darwis", "@adarwis", "http://content.ig.com"],
  ["3", "Denny Santoso", "@dennysantoso", "http://content.ig.com"],
  ["4", "Fadil Jaidi", "@fadiljaidi", "http://content.ig.com"],
  ["5", "Merry Riana", "@merryriana", "http://content.ig.com"],
]

const steps = ["Draft", "Quotation", "Running", "Report", "Invoice", "Finish"]

export default function ReportPage() {

      const [sortField, setSortField] = useState("");
      const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
      const [creatorData, setCreatorData] = useState(creators);
      const router = useRouter();
    
      const currentStep = 3;
  
      const progressWidth =
      currentStep === 3
        ? "55%"
        : `${(currentStep / (steps.length - 1)) * 100}%`;
  
  const stepDates = [
    "17 May 2026", // Draft
    "20 May 2026", // Quotation
    "22 May 2026", // Running
    "24 May 2026", // Report
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

const handleGenerateInvoice = async () => {
  try {
    const response = await fetch("/api/payment");
    if (!response.ok) throw new Error("Failed to fetch payment options");
    const payments = await response.json();

    const result = await confirmGenerateInvoice(payments);
    if (!result) return; // user tutup modal tanpa submit


    router.push("/tracking/invoice");
  } catch (error) {
    console.error(error);
  }
};

  return (
    <DefaultLayout>
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-7">
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Detail Project</h1>

          <span className="mt-3 inline-flex rounded-full border border-emerald-400 bg-emerald-50 px-5 py-1 text-xs font-bold text-emerald-700">
            Report
          </span>

          <div className="-mx-4 mt-8 overflow-x-auto px-4 touch-pan-x sm:mx-0 sm:mt-12 sm:px-0">
            <div className="relative min-w-[720px] px-4 sm:min-w-[1000px] sm:px-8">

              <div className="absolute left-14 right-14 top-3 h-1 rounded-full bg-slate-300" />

              <div
                className="absolute left-14 top-3 h-1 rounded-full bg-emerald-500"
                style={{ width: progressWidth }}
              />

              <div className="relative flex justify-between">
                {steps.map((step, index) => {
                  const completed = index < currentStep;
                  const active = index === currentStep;

                  return (
                    <div key={step} className="flex w-28 flex-col items-center">
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

          <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-7">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">List Result Report</h2>
          <p className="text-sm text-slate-700">Data From Creator</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs">
              <span>Show</span>
              <input defaultValue="10" className="h-10 w-16 border border-slate-300 px-3" />
              <span>entries</span>
            </div>

            <button
              onClick={() =>
                router.push("/tracking/report/detail-report")
              }
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-8 py-3 text-sm font-semibold text-slate-700 sm:w-auto"
            >
              <ReportIcon className="h-5 w-5" />
              View Report
            </button>
          </div>

          <div className="mt-6 w-full overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-[1300px] w-full border-collapse whitespace-nowrap text-sm">
              <thead>
                <tr>
                {[
                  { label: "", index: -1, field: "" },
                  { label: "No.", index: 0, field: "no" },
                  { label: "Photo", index: -1, field: "" },
                  { label: "Influencer Name", index: 1, field: "name" },
                  { label: "Username IG", index: 2, field: "username" },
                  { label: "Url Content", index: 3, field: "url" },
                  { label: "SOW", index: -1, field: "" },
                ].map((head) => (
                  <th
                    key={head.label}
                    onClick={() =>
                      head.index >= 0 &&
                      handleSort(head.index, head.field)
                    }
                    className={`border border-slate-200 px-4 py-4 text-center text-xs font-bold ${
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
                    <td className="border border-slate-200 px-4 py-4 text-center">
                      <input type="checkbox" defaultChecked className="h-5 w-5 accent-sky-500" />
                    </td>
                    <td className="border border-slate-200 px-4 py-4 text-center">{row[0]}</td>
                    <td className="border border-slate-200 px-4 py-3">
                      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 text-white">
                        🖼️
                      </div>
                    </td>
                    <td className="border border-slate-200 px-4 py-4">{row[1]}</td>
                    <td className="border border-slate-200 px-4 py-4">{row[2]}</td>
                    <td className="border border-slate-200 px-4 py-4">{row[3]}</td>
                    <td className="border border-slate-200 px-4 py-4">
                      <div className="flex justify-center items-center">
                      <button
                        onClick={() =>
                          router.push("/tracking/report/detail-report")
                        }
                        className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-1 text-sm text-slate-700"
                      >
                        <InvoiceIcon className="h-4 w-4" />
                        View
                      </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-slate-700">Showing 1 to 5 of 5 entries</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            onClick={handleGenerateInvoice}
            className="w-full rounded-xl bg-black px-8 py-3 text-sm font-semibold text-white sm:w-auto"
          >
            Generate Invoice
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
