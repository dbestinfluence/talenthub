"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

type ReportFilterValue = {
  date: string;
  shift: string;
  dayNight: string;
};

type ReportFilterOptions = {
  dates: string[];
  shifts: string[];
  dayNights: string[];
};

type AutoSubmitReportFiltersProps = {
  selectedFilter: ReportFilterValue;
  filterOptions: ReportFilterOptions;
  className?: string;
};

export default function AutoSubmitReportFilters({
  selectedFilter,
  filterOptions,
  className = "grid w-full min-w-0 gap-3 sm:grid-cols-3 xl:min-w-[560px]",
}: AutoSubmitReportFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState(selectedFilter);
  const dateSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setFilters(selectedFilter);
  }, [selectedFilter]);

  useEffect(() => {
    return () => {
      if (dateSyncTimeoutRef.current) {
        clearTimeout(dateSyncTimeoutRef.current);
      }
    };
  }, []);

  function pushFilters(nextFilters: ReportFilterValue) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", nextFilters.date);
    params.set("shift", nextFilters.shift);
    params.set("dayNight", nextFilters.dayNight);

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function updateFilter(key: keyof ReportFilterValue, value: string) {
    if (dateSyncTimeoutRef.current) {
      clearTimeout(dateSyncTimeoutRef.current);
      dateSyncTimeoutRef.current = null;
    }

    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
    pushFilters(nextFilters);
  }

  function updateDateFilter(value: string) {
    setFilters((current) => {
      const nextFilters = { ...current, date: value };

      if (dateSyncTimeoutRef.current) {
        clearTimeout(dateSyncTimeoutRef.current);
      }

      dateSyncTimeoutRef.current = setTimeout(() => {
        pushFilters(nextFilters);
        dateSyncTimeoutRef.current = null;
      }, 250);

      return nextFilters;
    });
  }

  return (
    <div className={className}>
      <FilterField label="Tanggal">
        <DateField
          name="date"
          value={filters.date}
          onChange={(event) => updateDateFilter(event.target.value)}
        />
      </FilterField>

      <FilterField label="Shift">
        <SelectField
          name="shift"
          value={filters.shift}
          onChange={(event) => updateFilter("shift", event.target.value)}
        >
          {filterOptions.shifts.map((shift) => (
            <option key={shift} value={shift}>
              {shift || "Tanpa Shift"}
            </option>
          ))}
        </SelectField>
      </FilterField>

      <FilterField label="Day / Night">
        <SelectField
          name="dayNight"
          value={filters.dayNight}
          onChange={(event) => updateFilter("dayNight", event.target.value)}
        >
          {filterOptions.dayNights.map((dayNight) => (
            <option key={dayNight} value={dayNight}>
              {dayNight}
            </option>
          ))}
        </SelectField>
      </FilterField>
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function SelectField(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className="h-11 w-full appearance-none rounded-xl border border-slate-300 bg-white px-3 pr-11 text-sm text-slate-700 outline-none transition focus:border-sky-500"
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
}

function DateField(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      type="date"
      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-sky-500"
    />
  );
}
