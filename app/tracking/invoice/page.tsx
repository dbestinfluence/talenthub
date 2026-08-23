"use client";

import { useState } from "react";
import DefaultLayout from "@/components/Layout/DefaultLayout"
import {
  confirmFinishProject,
  showSuccess,
} from "@/lib/alert";
import FileDocumentIcon from "@/components/icons/FileDocumentIcon";

const projectDetail = {
  brand: "CAFE PRO",
  projectName: "NEW YEAR 2",
  pic: "Gumelar Akhirul",
  date: "24 May 2026",
};

const items = [
  {
    no: 1,
    description: "William Tanuwijaya - Launch Campaign",
    sow: "Feed Instagram",
    platform: "Instagram",
    cost: "Rp.20.000.000",
  },
  {
    no: 2,
    description: "Raymond Chin - Awareness Campaign",
    sow: "Instagram Reels",
    platform: "Instagram",
    cost: "Rp.35.000.000",
  },
  {
    no: 3,
    description: "Andrew Darwis - Product Review",
    sow: "Instagram Story",
    platform: "Instagram",
    cost: "Rp.15.000.000",
  },
  {
    no: 4,
    description: "Fadil Jaidi - Viral Content",
    sow: "TikTok Video",
    platform: "TikTok",
    cost: "Rp.50.000.000",
  },
  {
    no: 5,
    description: "Merry Riana - Branding Campaign",
    sow: "YouTube Integration",
    platform: "YouTube",
    cost: "Rp.80.000.000",
  },
];

const steps = ["Draft", "Quotation", "Running", "Report", "Invoice", "Finish"]

export default function InvoicePage() {
        const [sortField, setSortField] = useState("");
        const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
        const [itemData, setItemData] = useState(items);
        const [isFinished, setIsFinished] = useState(false);
      
        const currentStep = isFinished ? 5 : 4;

        const progressWidth = isFinished ? "100%" : "72%";

        const stepDates = [
          "17 May 2026",
          "20 May 2026",
          "22 May 2026",
          "24 May 2026",
          "26 May 2026",
          isFinished ? "27 May 2026" : "-",
        ];
    
      const handleSort = (columnIndex: number, field: string) => {
      const direction =
        sortField === field && sortDirection === "asc"
          ? "desc"
          : "asc";
    
      setSortField(field);
      setSortDirection(direction);
    
      const sorted = [...itemData].sort((a, b) => {
        const aValue = String(a[field as keyof typeof a]);
        const bValue = String(b[field as keyof typeof b]);

        return direction === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      });

      setItemData(sorted);
    };
    
    const getSortIcon = (field: string) => {
      if (sortField !== field) return "↕";
      return sortDirection === "asc" ? "▲" : "▼";
    };

    const handleFinish = async () => {
  const result = await confirmFinishProject();

  if (!result.isConfirmed) return;

  await showSuccess(
    "Success",
    "Project has been completed."
  );

  setIsFinished(true);
};

  return (
    <DefaultLayout>
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Detail Project</h1>
              <span className="mt-3 inline-flex rounded-full border border-emerald-400 bg-emerald-50 px-5 py-1 text-xs font-bold text-emerald-700">
               {isFinished ? "Finish" : "Invoice"}
              </span>
            </div>

            {!isFinished && (
              <button className="w-full rounded-xl border border-slate-300 bg-white px-8 py-3 text-sm font-semibold sm:w-auto">
                ✎ Edit Header
              </button>
            )}
          </div>

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
                    <div
                      key={step}
                      className="flex w-28 flex-col items-center"
                    >
                      <div  
                        className={`h-8 w-8 rounded-full border-4 ${
                          isFinished
                            ? "border-emerald-500 bg-emerald-500"
                            : completed
                            ? "border-emerald-500 bg-emerald-500"
                            : active
                            ? "border-orange-500 bg-orange-500"
                            : "border-slate-300 bg-white"
                        }`}
                      />

                      <p
                        className={`mt-3 text-sm font-semibold ${
                          isFinished || completed || active
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
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">List Items</h2>
          <p className="text-sm text-slate-700">Creator Found</p>

          <div className="mt-8 flex items-center gap-2 text-xs">
            <span>Show</span>
            <input defaultValue="10" className="h-10 w-16 border border-slate-300 px-3" />
            <span>entries</span>
          </div>

          <div className="mt-6 w-full overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-max border-collapse whitespace-nowrap text-sm">
              <thead>
                <tr>
                  {[
                    { label: "No.", field: "no" },
                    { label: "Description", field: "description" },
                    { label: "SOW", field: "sow" },
                    { label: "Platforms", field: "platform" },
                    { label: "Rate Card", field: "cost" },
                  ].map((head, index) => (
                    <th
                      key={head.label}
                      onClick={() => handleSort(index, head.field)}
                      className="cursor-pointer border border-slate-200 px-6 py-4 text-center text-xs font-bold hover:bg-slate-50"
                    >
                      {head.label}

                      <span className="ml-1 text-slate-400">
                        {getSortIcon(head.field)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {itemData.map((item) => (
                  <tr key={item.no}>
                    <td className="border border-slate-200 px-6 py-4 text-center">
                      {item.no}
                    </td>

                    <td className="border border-slate-200 px-6 py-4 text-center">
                      {item.description}
                    </td>

                    <td className="border border-slate-200 px-6 py-4 text-center">
                      <select className="rounded-lg border border-slate-300 px-3 py-1">
                        <option>{item.sow}</option>
                      </select>
                    </td>

                    <td className="border border-slate-200 px-6 py-4 text-center">
                      {item.platform}
                    </td>

                    <td className="border border-slate-200 px-6 py-4 text-center">
                      {item.cost}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-8">
            <h3 className="text-xl font-bold text-slate-900">
              Payment Method
            </h3>

            <div className="mt-8 space-y-4 text-sm">
                <PaymentRow label="Bank" value="Bank Mandiri" />
                <PaymentRow label="Account No" value="12363-3284-9382" />
                <PaymentRow label="Account Name" value="D’Best Influence Marketing" />
              </div>
            </div>

            <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-8">
              <div className="space-y-2 text-sm">
              <TotalRow label="Subtotal" value="Rp 100,000,000" />
              <TotalRow label="DPP" value="Rp 100,000,000" />
              <TotalRow label="PPN (11%)" value="Rp 11,000,000" />
              </div>

              <div className="mt-8 flex justify-between text-lg font-bold">
                <span>Grand Total</span>
                <span>Rp 111,000,000</span>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
          <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-8 py-3 text-sm font-semibold sm:w-auto">
            <FileDocumentIcon className="h-4 w-4 text-black" />
            Export PDF
          </button>

          <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-8 py-3 text-sm font-semibold sm:w-auto">
            <FileDocumentIcon className="h-4 w-4 text-black" />
            Send PDF
          </button>

          {!isFinished && (
            <button
              onClick={handleFinish}
              className="w-full rounded-xl bg-black px-10 py-3 text-sm font-semibold text-white sm:w-auto"
            >
              Finish
            </button>
          )}
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

function PaymentRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <span className="text-slate-700">
        {label}
      </span>

      <span className="font-semibold text-slate-900 text-right">
        {value}
      </span>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  )
}
