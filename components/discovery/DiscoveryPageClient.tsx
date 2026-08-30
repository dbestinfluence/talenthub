"use client";

import { useState, useRef, useEffect, type SyntheticEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { showAlertValidationError, showAlertSuccess } from "@/lib/alert";
import Link from "next/link";

const SortIcon = () => <span className="text-gray-400 text-xs ml-1">⇅</span>;

// Tipe data
type Creator = {
  no: number;
  name: string;
  username: string;
  photo_url: string | null;
  followers: string;
  post: string;
  // ER lama (single "er") DIHAPUS, diganti 3 field ER di bawah ini.
  erFollowers: string;
  erViews: string;
  erTalenthub: string;
  avgLikes: string;
  avgComments: string;
  avrView: string;
  avrBrand: string;
  cpvAll: string;
  cpvBranded: string;
  social_media: string;
  tier: string;
  gender: string;
  city_id: number | null;
  category_id: number | null;
  followersRaw: number;
};

// --- BARU: tipe untuk Quick Search ---
type QuickSearchPreview = {
  username: string;
  socialMedia: string;
  followers: number;
  following: number;
  totalPost: number;
  photoUrl?: string;
  bio: string;
  categoryName?: string;
};

type QuickSearchResult = {
  inserted: boolean;
  reason?: "not_found" | "not_indonesia";
  message?: string;
  preview: QuickSearchPreview | null;
  creatorId?: number;
};

const DEFAULT_DISCOVERY_FILTERS = [
  {
    id: "social_media",
    label: "Social Media",
    options: ["Instagram", "TikTok"],
  },
  { id: "tier", label: "Tier", options: ["Nano", "Micro", "Macro", "Mega"] },
  { id: "category", label: "Category", options: [] },
  { id: "city", label: "City", options: [] },
  { id: "gender", label: "Gender", options: ["Male", "Female"] },
];

function profilePhotoSource(value: string | null): string {
  const url = String(value ?? "").trim();

  if (!url) {
    return "/image/default-kol-avatar.png";
  }

  // Foto yang sudah tersimpan di Vercel Blob bersifat publik,
  // sehingga bisa langsung digunakan tanpa /api/image-proxy.
  if (
    url.startsWith("/") ||
    url.startsWith("data:image/") ||
    url.startsWith("blob:") ||
    /^https?:\/\//i.test(url)
  ) {
    return url;
  }

  return "/image/default-kol-avatar.png";
}

function handleProfilePhotoError(
  event: SyntheticEvent<HTMLImageElement>
) {
  const image = event.currentTarget;

  if (image.dataset.fallbackApplied === "true") {
    return;
  }

  image.dataset.fallbackApplied = "true";
  image.src = "/image/default-kol-avatar.png";
}

// --- BARU: badge kecil buat nampilin Instagram / TikTok di kolom tabel ---
function SocialMediaBadge({ value }: { value: string }) {
  const normalized = String(value ?? "").toLowerCase();
  const isInstagram = normalized === "instagram";
  const isTiktok = normalized === "tiktok";

  const label = isInstagram
    ? "Instagram"
    : isTiktok
    ? "TikTok"
    : value || "-";

  const classes = isInstagram
    ? "bg-pink-50 text-pink-600 border-pink-200"
    : isTiktok
    ? "bg-slate-900/5 text-slate-700 border-slate-300"
    : "bg-slate-50 text-slate-500 border-slate-200";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${classes}`}
    >
      {label}
    </span>
  );
}

export default function CreatorDiscoveryPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // --- MODE EDIT: dideteksi dari query ?projectId=xxx ---
  const projectId = searchParams.get("projectId");
  const isEditMode = Boolean(projectId);

  // ID creator yang sudah ada di project ini (untuk disembunyikan dari list)
  const [existingCreatorIds, setExistingCreatorIds] = useState<number[]>([]);

  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const [dynamicFilters, setDynamicFilters] = useState<any[]>(
    DEFAULT_DISCOVERY_FILTERS
  );
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [filterError, setFilterError] = useState("");
  const [filterReload, setFilterReload] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);

   const [brandsOptions, setBrandsOptions] = useState<{ id: string; name: string }[]>([]);

  const [isFiltered, setIsFiltered] = useState(true);

  const [creatorsData, setCreatorsData] = useState<Creator[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>(
    {}
  );

  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [otherInputs, setOtherInputs] = useState<Record<string, string>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const refreshedPhotoPages = useRef(new Set<string>());

  // --- STATES MODAL ADD PROJECT (hanya dipakai kalau BUKAN edit mode) ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // --- BARU: Quick Search 1 akun (scrape langsung, bukan dari filter) ---
  const [quickSearchSocialMedia, setQuickSearchSocialMedia] =
    useState("instagram");
  const [quickSearchUsername, setQuickSearchUsername] = useState("");
  const [quickSearching, setQuickSearching] = useState(false);
  const [quickSearchResult, setQuickSearchResult] =
    useState<QuickSearchResult | null>(null);
  // --- BARU: quick search (scraping) disembunyikan by default supaya gak boros token ---
  const [showQuickSearch, setShowQuickSearch] = useState(false);

  // --- BARU: Search username dari data yang SUDAH ada di database (tanpa scraping) ---
  const [usernameSearch, setUsernameSearch] = useState("");

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpenDropdownId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function loadDropdownFilters() {
      setLoadingFilters(true);
      setFilterError("");
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const res = await fetch("/api/filter", {
            cache: "no-store",
            signal: controller.signal,
          });
          const data = await res.json().catch(() => null);
          if (!res.ok) throw new Error(data?.error ?? "Failed to load filters");
          if (!Array.isArray(data)) throw new Error("Invalid filter response");
          if (!controller.signal.aborted) {
            const loadedById = new Map(
              data.map((filter: any) => [filter.id, filter])
            );
            setDynamicFilters(
              DEFAULT_DISCOVERY_FILTERS.map((fallback) => {
                const loaded = loadedById.get(fallback.id) as any;
                return loaded ? { ...fallback, ...loaded } : fallback;
              })
            );
          }
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError")
            return;
          lastError =
            error instanceof Error
              ? error
              : new Error("Failed to load filters");
          if (attempt < 3)
            await new Promise((resolve) => setTimeout(resolve, attempt * 600));
        }
      }

      if (!controller.signal.aborted)
        setFilterError(lastError?.message ?? "Failed to load filters");
    }
    void loadDropdownFilters().finally(() => {
      if (!controller.signal.aborted) setLoadingFilters(false);
    });
    return () => controller.abort();
  }, [filterReload]);

  useEffect(() => {
    async function loadBrands() {
      try {
        const res = await fetch("/api/discovery/brand");
        if (res.ok) {
          const data = await res.json();
          setBrandsOptions(data);
        }
      } catch (error) {
        console.error("Error fetching brands:", error);
      }
    }
    loadBrands();
  }, []);

  // --- BARU: kalau edit mode, ambil creator yang SUDAH ada di project ---
  useEffect(() => {
    if (!isEditMode || !projectId) return;

    async function loadExistingCreators() {
      try {
        const res = await fetch(`/api/tracking/detail?projectId=${projectId}`);
        if (res.ok) {
          const data = await res.json();
          const ids = (data.creators || []).map((c: any) => c.creatorId);
          setExistingCreatorIds(ids);
        }
      } catch (error) {
        console.error("Error fetching existing project creators:", error);
      }
    }

    loadExistingCreators();
  }, [isEditMode, projectId]);

  useEffect(() => {
    async function fetchCreators() {
      try {
        const params = new URLSearchParams();
        Object.entries(appliedFilters).forEach(([key, val]) => {
          if (val) params.append(key, val);
        });

        const res = await fetch(`/api/discovery?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setCreatorsData(data);
        }
      } catch (error) {
        console.log("Error fetching creators:", error);
      }
    }
    fetchCreators();
  }, [appliedFilters]);

  const handleSelectOption = (id: string, value: string) => {
    setFilters((prev) => ({ ...prev, [id]: value }));
    setOpenDropdownId(null);
  };

  const handleAddCustomOption = async (id: string) => {
    const customValue = otherInputs[id]?.trim();

    if (!customValue) {
      showAlertValidationError("Input cannot be empty!");
      return;
    }

    const targetFilter = dynamicFilters.find((f) => f.id === id);
    if (
      targetFilter &&
      targetFilter.options?.some(
        (opt: string | { id: string; name: string }) =>
          (typeof opt === "string" ? opt : opt.name).toLowerCase() ===
          customValue.toLowerCase()
      )
    ) {
      showAlertValidationError(
        "This option already exists in the filter list!"
      );
      return;
    }

    try {
      const res = await fetch("/api/filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: id, value: customValue }),
      });

      const result = await res.json();

      if (!res.ok) {
        showAlertValidationError(result.error || "Failed to save data.");
        return;
      }

      const newOption = {
        id: String(result.data.id),
        name: String(result.data.name),
      };
      setDynamicFilters((prevFilters) =>
        prevFilters.map((f) => {
          if (f.id === id) {
            return { ...f, options: [...f.options, newOption] };
          }
          return f;
        })
      );

      setFilters((prev) => ({ ...prev, [id]: newOption.id }));
      setOtherInputs((prev) => ({ ...prev, [id]: "" }));
      showAlertSuccess(`"${customValue}" successfully added!`);
    } catch (error) {
      showAlertValidationError("A connection error occurred.");
    }
  };

  const handleApplyFilter = () => {
    setAppliedFilters(filters);
    setIsFiltered(true);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({});
    setAppliedFilters({});
    setOtherInputs({});
    setIsFiltered(true);
    setSelectedRows([]);
    setCurrentPage(1);
    setUsernameSearch("");
  };

  const toggleSelect = (no: number) => {
    setSelectedRows((prev) =>
      prev.includes(no) ? prev.filter((id) => id !== no) : [...prev, no]
    );
  };

  const filteredCreators = creatorsData.filter((creator) => {
    // --- BARU: sembunyikan creator yang sudah ada di project (mode edit) ---
    if (isEditMode && existingCreatorIds.includes(creator.no)) {
      return false;
    }

    // --- BARU: search by username/nama dari data yang sudah ada (independen dari filter lain) ---
    if (usernameSearch.trim()) {
      const keyword = usernameSearch.trim().toLowerCase();
      const matchUsername = creator.username?.toLowerCase().includes(keyword);
      const matchName = creator.name?.toLowerCase().includes(keyword);
      if (!matchUsername && !matchName) return false;
    }

    if (!isFiltered) return true;

    if (
      appliedFilters.social_media &&
      creator.social_media?.toLowerCase() !==
        appliedFilters.social_media?.toLowerCase()
    ) {
      return false;
    }

    if (appliedFilters.tier) {
      const count = creator.followersRaw ?? 0;
      if (appliedFilters.tier.startsWith("Nano")) {
        if (count < 1000 || count >= 10000) return false;
      } else if (appliedFilters.tier.startsWith("Micro")) {
        if (count < 10000 || count >= 100000) return false;
      } else if (appliedFilters.tier.startsWith("Macro")) {
        if (count < 100000 || count >= 1000000) return false;
      } else if (appliedFilters.tier.startsWith("Mega")) {
        if (count < 1000000) return false;
      }
    }

    if (
      appliedFilters.gender &&
      creator.gender?.toLowerCase() !== appliedFilters.gender?.toLowerCase()
    ) {
      return false;
    }

    if (appliedFilters.category) {
      const matchId =
        creator.category_id?.toString() === appliedFilters.category;
      if (!matchId) return false;
    }

    if (appliedFilters.city) {
      const matchCityId = creator.city_id?.toString() === appliedFilters.city;
      if (!matchCityId) return false;
    }

    return true;
  });

  const totalEntries = filteredCreators.length;
  const totalPages = Math.ceil(totalEntries / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = Math.min(startIndex + entriesPerPage, totalEntries);

  const currentData = filteredCreators.slice(startIndex, endIndex);
  const currentPhotoPageKey = currentData
    .map((creator) => creator.no)
    .sort((a, b) => a - b)
    .join(",");

  useEffect(() => {
    if (
      !currentPhotoPageKey ||
      refreshedPhotoPages.current.has(currentPhotoPageKey)
    )
      return;
    refreshedPhotoPages.current.add(currentPhotoPageKey);
    const controller = new AbortController();

    async function refreshVisibleProfilePhotos() {
      try {
        const creatorIds = currentPhotoPageKey.split(",").map(Number);
        const response = await fetch("/api/discovery/profile-photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creatorIds }),
          signal: controller.signal,
        });
        if (!response.ok) return;

        const result = (await response.json()) as {
          photos?: Array<{ id: number; photo_url: string | null }>;
        };
        const photos = new Map(
          (result.photos ?? [])
            .filter((item) => item.photo_url)
            .map((item) => [item.id, item.photo_url])
        );
        if (!photos.size || controller.signal.aborted) return;

        setCreatorsData((previous) =>
          previous.map((creator) => ({
            ...creator,
            photo_url: photos.get(creator.no) ?? creator.photo_url,
          }))
        );
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Failed to refresh profile photos:", error);
        }
      }
    }

    void refreshVisibleProfilePhotos();
    return () => controller.abort();
  }, [currentPhotoPageKey]);

  const toggleSelectAll = () => {
    const currentPageIds = currentData.map((item) => item.no);
    const isAllCurrentSelected = currentPageIds.every((id) =>
      selectedRows.includes(id)
    );

    if (isAllCurrentSelected) {
      setSelectedRows((prev) =>
        prev.filter((id) => !currentPageIds.includes(id))
      );
    } else {
      const newSelections = currentPageIds.filter(
        (id) => !selectedRows.includes(id)
      );
      setSelectedRows((prev) => [...prev, ...newSelections]);
    }
  };

  // --- LOGIC MODAL (khusus mode BUAT project baru) ---
  const handleOpenModal = () => {
    if (selectedRows.length === 0) {
      showAlertValidationError("Please Select Min 1 KOL");
      return;
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setProjectName("");
    setSelectedBrand("");
    setStartDate("");
    setEndDate("");
    setIsBrandDropdownOpen(false);
  };

  const handleSubmitProject = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectName || !selectedBrand || !startDate || !endDate) {
      showAlertValidationError("Please fill all project details!");
      return;
    }

    if (endDate < startDate) {
      showAlertValidationError("End Date cannot be earlier than Start Date.");
      return;
    }

    const selectedCreatorsData = creatorsData.filter((creator) =>
      selectedRows.includes(creator.no)
    );

    try {
      const res = await fetch("/api/discovery/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: projectName,
          brandId: selectedBrand,
          startDate: startDate,
          endDate: endDate,
          selectedCreators: selectedCreatorsData,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        showAlertValidationError(result.error || "Failed to save project.");
        return;
      }

      showAlertSuccess(
        `Project "${projectName}" successfully saved to database!`
      );

      setIsModalOpen(false);
      setProjectName("");
      setSelectedBrand("");
      setStartDate("");
      setEndDate("");
      setSelectedRows([]);
    } catch (error) {
      console.error("Connection error while submitting project:", error);
      showAlertValidationError(
        "A connection error occurred while saving the project."
      );
    }
  };

  // --- BARU: LOGIC UPDATE PROJECT (khusus mode EDIT, tambah creator ke project lama) ---
  const handleUpdateProject = async () => {
    if (selectedRows.length === 0) {
      showAlertValidationError("Please Select Min 1 KOL");
      return;
    }

    const selectedCreatorsData = creatorsData.filter((creator) =>
      selectedRows.includes(creator.no)
    );

    try {
      const res = await fetch(`/api/discovery/${projectId}/creators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedCreators: selectedCreatorsData }),
      });

      const result = await res.json();

      if (!res.ok) {
        showAlertValidationError(result.error || "Failed to update project.");
        return;
      }

      showAlertSuccess("Creator successfully added to the project!");
      setSelectedRows([]);

      // TODO: sesuaikan path ini dengan route halaman draft/tracking kamu
      router.push(`/tracking/detail?projectId=${projectId}&view=Draft`);
    } catch (error) {
      console.error("Connection error while updating project:", error);
      showAlertValidationError(
        "A connection error occurred while updating the project."
      );
    }
  };

  // --- BARU: Search 1 akun spesifik -> scrape -> kalau lolos ketentuan, insert & buka detail.
  // Kalau enggak, tetap tampilin datanya di layar tanpa insert.
  const handleQuickSearch = async () => {
    const cleanUsername = quickSearchUsername.trim().replace(/^@+/, "");
    if (!cleanUsername) {
      showAlertValidationError("Username wajib diisi");
      return;
    }

    setQuickSearching(true);
    setQuickSearchResult(null);

    try {
      const res = await fetch("/api/discovery/quick-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: cleanUsername,
          socialMedia: quickSearchSocialMedia,
        }),
      });
      const data: QuickSearchResult = await res.json();

      if (!res.ok) {
        showAlertValidationError((data as any).error || "Gagal mencari akun.");
        return;
      }

      if (data.inserted && data.creatorId) {
        showAlertSuccess(`"${cleanUsername}" berhasil disimpan!`);
        router.push(`/tracking/detail/detail/${data.creatorId}`);
        return;
      }

      // Gak lolos ketentuan / gak ketemu -> tampilkan aja di layar, gak insert
      setQuickSearchResult(data);
    } catch (error) {
      showAlertValidationError("Terjadi kesalahan koneksi.");
    } finally {
      setQuickSearching(false);
    }
  };

  return (
    <section className="relative min-h-screen min-w-0 bg-slate-50 p-0 sm:p-4 lg:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {isEditMode ? "Add More Creators" : "Discovery"}
        </h1>
        <p className="text-sm text-slate-500">
          {isEditMode
            ? "Select additional creators to add to this project"
            : "Discover the right creators for your campaigns"}
        </p>
      </div>

      <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)] xl:gap-6">
        <div
          ref={dropdownRef}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"
        >
          <h2 className="font-bold mb-4">Filter</h2>

          {loadingFilters ? (
            <div className="text-sm text-slate-400 text-center py-6 italic animate-pulse">
              Loading filters from database...
            </div>
          ) : filterError && dynamicFilters.length === 0 ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-center">
              <p className="text-xs font-medium text-rose-700">{filterError}</p>
              <button
                type="button"
                onClick={() => setFilterReload((value) => value + 1)}
                className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {dynamicFilters.map((filter) => (
                <div key={filter.id} className="relative">
                  <label className="block text-sm font-medium mb-1 text-slate-700">
                    {filter.label}
                  </label>

                  <div
                    onClick={() =>
                      setOpenDropdownId(
                        openDropdownId === filter.id ? null : filter.id
                      )
                    }
                    className={`w-full h-10 border rounded-lg px-3 flex items-center justify-between text-sm cursor-pointer transition-colors ${
                      openDropdownId === filter.id
                        ? "border-blue-500 ring-2 ring-blue-50"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    <span
                      className={
                        filters[filter.id] ? "text-slate-900" : "text-slate-400"
                      }
                    >
                      {(() => {
                        const selectedValue = filters[filter.id];
                        if (!selectedValue) return `Select ${filter.label}`;

                        const foundOption = filter.options?.find(
                          (opt: string | { id: string; name: string }) =>
                            typeof opt === "object"
                              ? opt.id === selectedValue
                              : opt === selectedValue
                        );

                        if (
                          typeof foundOption === "object" &&
                          foundOption !== null
                        ) {
                          return foundOption.name;
                        }

                        return selectedValue;
                      })()}
                    </span>

                    <svg
                      className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${
                        openDropdownId === filter.id ? "rotate-180" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>

                  {openDropdownId === filter.id && (
                    <div className="absolute z-40 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      <div className="py-1">
                        {filter.options?.map(
                          (option: string | { id: string; name: string }) => {
                            const isObject =
                              typeof option === "object" && option !== null;
                            const optionValue = isObject ? option.id : option;
                            const optionLabel = isObject ? option.name : option;

                            return (
                              <div
                                key={optionValue}
                                onClick={() =>
                                  handleSelectOption(filter.id, optionValue)
                                }
                                className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                                  filters[filter.id] === optionValue
                                    ? "bg-blue-50 text-blue-600 font-medium"
                                    : "hover:bg-slate-50 text-slate-700"
                                }`}
                              >
                                {optionLabel}
                              </div>
                            );
                          }
                        )}
                      </div>

                      {(filter.id === "category" || filter.id === "city") && (
                        <div className="border-t border-slate-100 p-2 bg-slate-50 sticky bottom-0">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              placeholder="Others..."
                              value={otherInputs[filter.id] || ""}
                              onChange={(e) =>
                                setOtherInputs((prev) => ({
                                  ...prev,
                                  [filter.id]: e.target.value,
                                }))
                              }
                              className="flex-1 h-8 border border-slate-300 rounded px-2 text-xs bg-white focus:outline-none focus:border-blue-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddCustomOption(filter.id)}
                              className="w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center justify-center font-bold text-lg transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              <button
                onClick={handleApplyFilter}
                className="w-full bg-black text-white py-2 rounded-lg font-medium text-sm mt-2 hover:bg-gray-800 transition-colors"
              >
                Apply Filter
              </button>
              <button
                onClick={clearFilters}
                className="w-full border border-slate-300 py-2 rounded-lg font-medium text-sm hover:bg-slate-50 transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-5 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Result Discovery
            </h1>
            <p className="text-gray-500">Creator Found</p>
          </div>

          {/* --- Quick Search 1 akun: scraping manual, disembunyikan by default biar gak boros token --- */}
          <div className="mb-6 rounded-xl border border-amber-200/80 bg-gradient-to-b from-amber-50/70 to-white overflow-hidden">
            <button
              type="button"
              onClick={() => setShowQuickSearch((prev) => !prev)}
              aria-expanded={showQuickSearch}
              className="w-full flex items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-amber-50/60"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                  <svg
                    className="w-4.5 h-4.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <circle cx="11" cy="11" r="7" strokeLinecap="round" />
                    <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
                    <path strokeLinecap="round" d="M11 8v3l2 1.5" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                    Search New Account
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                      Scraping · uses quota
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Only for accounts not yet in the database. Try the
                    "Search existing data" field below first to save tokens.
                  </p>
                </div>
              </div>
              <svg
                className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${
                  showQuickSearch ? "rotate-180" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {showQuickSearch && (
              <div className="border-t border-amber-200/80 p-4 pt-3.5">
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={quickSearchSocialMedia}
                    onChange={(e) => setQuickSearchSocialMedia(e.target.value)}
                    className="h-10 border border-slate-300 rounded-lg px-3 text-sm bg-white sm:w-40"
                  >
                    <option value="instagram">Instagram</option>
                    <option value="tiktok">TikTok</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Username (Without @)"
                    value={quickSearchUsername}
                    onChange={(e) => setQuickSearchUsername(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleQuickSearch()}
                    className="flex-1 h-10 border border-slate-300 rounded-lg px-3 text-sm bg-white"
                  />
                  <button
                    onClick={handleQuickSearch}
                    disabled={quickSearching}
                    className="h-10 px-5 bg-black text-white rounded-lg font-medium text-sm hover:bg-gray-800 disabled:opacity-50 whitespace-nowrap"
                  >
                    {quickSearching ? "Scraping..." : "Search & Save"}
                  </button>
                </div>

                {/* Hasil kalau GAK di-insert (gak lolos ketentuan / gak ketemu) */}
                {quickSearchResult && (
                  <div
                    className={`mt-3 rounded-lg border p-3 ${
                      quickSearchResult.preview
                        ? "border-amber-200 bg-amber-50"
                        : "border-rose-200 bg-rose-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-xs font-semibold ${
                          quickSearchResult.preview
                            ? "text-amber-700"
                            : "text-rose-600"
                        }`}
                      >
                        {quickSearchResult.reason === "not_indonesia"
                          ? "Tidak disimpan — bukan akun Indonesia"
                          : quickSearchResult.message}
                      </p>
                      <button
                        onClick={() => setQuickSearchResult(null)}
                        className="text-slate-400 hover:text-slate-600 text-sm leading-none"
                      >
                        ×
                      </button>
                    </div>

                    {quickSearchResult.preview && (
                      <div className="flex items-center gap-3 mt-2">
                        <img
                          src={
                            quickSearchResult.preview.photoUrl ||
                            "/image/default-kol-avatar.png"
                          }
                          alt={quickSearchResult.preview.username}
                          className="w-12 h-12 rounded-lg object-cover bg-slate-100"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 text-sm truncate">
                            {quickSearchResult.preview.username}
                          </p>
                          <p className="text-xs text-slate-500">
                            {quickSearchResult.preview.followers.toLocaleString()}{" "}
                            followers ·{" "}
                            {quickSearchResult.preview.totalPost.toLocaleString()}{" "}
                            posts
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-3 sm:gap-4">
            {selectedRows.length > 0 && (
              <div className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium text-sm">
                <span>{selectedRows.length} selected</span>
                <button
                  onClick={() => setSelectedRows([])}
                  className="hover:bg-blue-700 p-1 rounded-full"
                >
                  ×
                </button>
              </div>
            )}
            {/* --- BARU: tombol berubah tergantung mode --- */}
            <button
              onClick={isEditMode ? handleUpdateProject : handleOpenModal}
              className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-gray-800 transition-colors"
            >
              <span>+</span> {isEditMode ? "Update Project" : "Add to Project"}
            </button>
          </div>

          {/* --- BARU: Show entries + search username dari data yang sudah ada di DB --- */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <span>Show</span>
              <select
                value={entriesPerPage}
                onChange={(e) => {
                  setEntriesPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-gray-300 rounded px-2 py-1 bg-white cursor-pointer focus:outline-none focus:border-blue-500"
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <span>entries</span>
            </div>

            <div className="w-full sm:w-72">
              <label
                htmlFor="db-username-search"
                className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500"
              >
                Search existing data
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Instant, free
                </span>
              </label>
              <div className="relative group">
                <svg
                  className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-blue-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  id="db-username-search"
                  type="text"
                  value={usernameSearch}
                  onChange={(e) => {
                    setUsernameSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Type a username or name..."
                  className="w-full h-10 rounded-lg border border-slate-300 bg-white pl-10 pr-9 text-sm shadow-sm transition-all focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                />
                {usernameSearch && (
                  <button
                    type="button"
                    onClick={() => setUsernameSearch("")}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 hover:text-slate-700 text-xs leading-none transition-colors"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg w-full max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm border-collapse min-w-[1500px]">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200 text-left sticky top-0 z-10 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">
                  <th className="p-3 w-12 border-r border-gray-200 text-center bg-gray-100">
                    <input
                      type="checkbox"
                      checked={
                        currentData.length > 0 &&
                        currentData.every((item) =>
                          selectedRows.includes(item.no)
                        )
                      }
                      onChange={toggleSelectAll}
                    />
                  </th>
                  {[
                    "No.",
                    "Photo",
                    "Influencer Name",
                    "Username",
                    "Social Media",
                    "Post",
                    "Followers",
                    "ER by Follower",
                    "ER by View",
                    "ER by Talenthub",
                    "Avg Like",
                    "Avg Comment",
                    "Avr View",
                    "Action detail",
                  ].map((head) => (
                    <th
                      key={head}
                      className="p-3 border-r border-gray-200 font-semibold text-gray-700 whitespace-nowrap bg-gray-100"
                    >
                      <div className="flex items-center justify-between">
                        <span>{head}</span>
                        <SortIcon />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentData.map((row, i) => (
                  <tr
                    key={row.no}
                    className="border-b border-gray-200 hover:bg-gray-50 text-gray-800"
                  >
                    <td className="p-3 border-r border-gray-200 text-center">
                      <input
                        type="checkbox"
                        checked={selectedRows.includes(row.no)}
                        onChange={() => toggleSelect(row.no)}
                      />
                    </td>
                    <td className="p-3 border-r border-gray-200 text-center">
                      {startIndex + i + 1}
                    </td>
                    <td className="p-3 border-r border-gray-200 text-center">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-blue-100 flex items-center justify-center mx-auto">
                        <img
                          src={profilePhotoSource(row.photo_url)}
                          alt={`${row.name} profile`}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={handleProfilePhotoError}
                        />
                      </div>
                    </td>
                    <td className="p-3 border-r border-gray-200 font-medium whitespace-nowrap">
                      {row.name}
                    </td>
                    <td className="p-3 border-r border-gray-200 text-gray-500 whitespace-nowrap">
                      {row.username}
                    </td>
                    <td className="p-3 border-r border-gray-200 whitespace-nowrap">
                      <SocialMediaBadge value={row.social_media} />
                    </td>
                    <td className="p-3 border-r border-gray-200 whitespace-nowrap">
                      {row.post}
                    </td>
                    <td className="p-3 border-r border-gray-200 whitespace-nowrap">
                      {row.followers}
                    </td>
                    <td className="p-3 border-r border-gray-200 whitespace-nowrap">
                      {row.erFollowers}
                    </td>
                    <td className="p-3 border-r border-gray-200 whitespace-nowrap">
                      {row.erViews}
                    </td>
                    <td className="p-3 border-r border-gray-200 whitespace-nowrap">
                      {row.erTalenthub}
                    </td>
                    <td className="p-3 border-r border-gray-200 whitespace-nowrap">
                      {row.avgLikes}
                    </td>
                    <td className="p-3 border-r border-gray-200 whitespace-nowrap">
                      {row.avgComments}
                    </td>
                    <td className="p-3 border-r border-gray-200 whitespace-nowrap">
                      {row.avrView}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <button
                        onClick={() =>
                          router.push(`/tracking/detail/detail/${row.no}`)
                        }
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-full transition-colors inline-flex items-center justify-center"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {currentData.length === 0 && (
                  <tr>
                    <td
                      colSpan={15}
                      className="p-8 text-center text-gray-400 italic"
                    >
                      {isEditMode
                        ? "All available creators are already in this project. Try adjusting the filters."
                        : "No data available. Please select and apply filters to discover creators."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
            <span>
              Showing {totalEntries > 0 ? startIndex + 1 : 0} to {endIndex} of{" "}
              {totalEntries} entries
            </span>

            {totalPages > 1 && (
              <div className="flex border border-gray-200 rounded-md overflow-hidden items-center bg-white">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 bg-gray-100 border-r border-gray-200 disabled:opacity-50 hover:bg-gray-200"
                >
                  Previous
                </button>

                {(() => {
                  const pageNumbers = [];
                  const siblings = 1;

                  if (totalPages <= 7) {
                    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
                  } else {
                    const showLeftDots = currentPage > 3;
                    const showRightDots = currentPage < totalPages - 2;

                    if (!showLeftDots && showRightDots) {
                      for (let i = 1; i <= 5; i++) pageNumbers.push(i);
                      pageNumbers.push("...");
                      pageNumbers.push(totalPages);
                    } else if (showLeftDots && !showRightDots) {
                      pageNumbers.push(1);
                      pageNumbers.push("...");
                      for (let i = totalPages - 4; i <= totalPages; i++)
                        pageNumbers.push(i);
                    } else if (showLeftDots && showRightDots) {
                      pageNumbers.push(1);
                      pageNumbers.push("...");
                      for (
                        let i = currentPage - siblings;
                        i <= currentPage + siblings;
                        i++
                      ) {
                        pageNumbers.push(i);
                      }
                      pageNumbers.push("...");
                      pageNumbers.push(totalPages);
                    }
                  }

                  return pageNumbers.map((page, index) => {
                    if (page === "...") {
                      return (
                        <span
                          key={`dots-${index}`}
                          className="px-3 py-1 border-r border-gray-200 bg-gray-50 text-gray-400 select-none"
                        >
                          ...
                        </span>
                      );
                    }

                    return (
                      <button
                        key={`page-${page}`}
                        type="button"
                        onClick={() =>
                          typeof page === "number" && setCurrentPage(page)
                        }
                        className={`px-3 py-1 border-r border-gray-200 transition-colors ${
                          page === currentPage
                            ? "bg-blue-50 font-bold text-blue-600"
                            : "hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        {page}
                      </button>
                    );
                  });
                })()}

                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(p + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- MODAL CREATE NEW PROJECT: hanya tampil kalau BUKAN edit mode --- */}
      {!isEditMode && isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#E9B35A] px-5 py-3.5 flex items-center justify-between text-white">
              <h3 className="font-semibold text-base tracking-wide text-center flex-1 ml-6">
                Create New Project
              </h3>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-black hover:bg-black/10 rounded-lg p-1 text-xl font-bold transition-colors w-7 h-7 flex items-center justify-center leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmitProject} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Fill Project Name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full h-10 border border-slate-300 rounded-lg px-3 text-sm focus:outline-none focus:border-blue-500 bg-white placeholder-slate-400"
                />
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Brand <span className="text-red-500">*</span>
                </label>
                <div
                  onClick={() => setIsBrandDropdownOpen(!isBrandDropdownOpen)}
                  className={`w-full h-10 border rounded-lg px-3 flex items-center justify-between text-sm cursor-pointer transition-colors ${
                    isBrandDropdownOpen
                      ? "border-blue-500 ring-2 ring-blue-50"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  <span
                    className={
                      selectedBrand ? "text-slate-900" : "text-slate-400"
                    }
                  >
                    {brandsOptions.find((b) => b.id === selectedBrand)?.name ||
                      "Choose Brand"}
                  </span>
                  <svg
                    className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${
                      isBrandDropdownOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>

                {isBrandDropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg show-lg max-h-40 overflow-y-auto">
                    {brandsOptions.map(
                      (brand: { id: string; name: string }) => (
                        <div
                          key={brand.id}
                          onClick={() => {
                            setSelectedBrand(brand.id);
                            setIsBrandDropdownOpen(false);
                          }}
                          className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                            selectedBrand === brand.id
                              ? "bg-blue-50 text-blue-600 font-medium"
                              : "hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          {brand.name}
                        </div>
                      )
                    )}
                    {brandsOptions.length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-400 italic text-center">
                        No brands available
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">
                    Selected Creators
                  </label>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {selectedRows.length}
                  </span>
                </div>
                <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                  {creatorsData
                    .filter((creator) => selectedRows.includes(creator.no))
                    .map((creator) => (
                      <div
                        key={creator.no}
                        className="flex items-center gap-3 rounded-lg bg-white p-2 shadow-sm"
                      >
                        <img
                          src={profilePhotoSource(creator.photo_url)}
                          onError={handleProfilePhotoError}
                          alt=""
                          className="h-9 w-9 rounded-full bg-slate-100 object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {creator.name}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            @{creator.username.replace(/^@+/, "")}
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-label={`Remove ${creator.name}`}
                          onClick={() =>
                            setSelectedRows((current) =>
                              current.filter((id) => id !== creator.no)
                            )
                          }
                          className="rounded-md px-2 py-1 text-lg font-bold text-rose-600 hover:bg-rose-50"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  {selectedRows.length === 0 && (
                    <p className="py-3 text-center text-xs text-slate-500">
                      No creators selected.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => {
                      const nextStartDate = e.target.value;
                      setStartDate(nextStartDate);

                      if (endDate && endDate < nextStartDate) {
                        setEndDate("");
                      }
                    }}
                    className="w-full h-10 border border-slate-300 rounded-lg px-3 text-sm focus:outline-none focus:border-blue-500 bg-white text-slate-700 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full h-10 border border-slate-300 rounded-lg px-3 text-sm focus:outline-none focus:border-blue-500 bg-white text-slate-700 uppercase"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-black text-white h-11 rounded-lg font-medium text-sm mt-2 hover:bg-gray-800 transition-colors active:scale-[0.99]"
              >
                Add To Project
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
