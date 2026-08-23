"use client";

import { useEffect, useRef, useState } from "react";
import { confirmDelete } from "@/lib/alert";

type Brand = {
  brd_id: number;
  brd_initial: string | null;
  brd_nama: string | null;
  brd_alamat: string | null;
  brd_email: string | null;
  brd_notelp: string | null;
  brd_pic1: string | null;
  brd_pic2: string | null;
  brd_pic3: string | null;
  brd_status: number | null;
};

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

export default function BrandPageClient() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brdInitial, setBrdInitial] = useState("");
  const [brdNama, setBrdNama] = useState("");
  const [brdAlamat, setBrdAlamat] = useState("");
  const [brdEmail, setBrdEmail] = useState("");
  const [brdNotelp, setBrdNotelp] = useState("");
  const [brdPic1, setBrdPic1] = useState("");
  const [brdPic2, setBrdPic2] = useState("");
  const [brdPic3, setBrdPic3] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  function showToast(type: "success" | "error", message: string) {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    setToast({ type, message });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 3200);
  }

  async function fetchBrands() {
    const res = await fetch("/api/brand", {
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error ?? "Failed to load brands");
    }

    setBrands(data);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);

        const res = await fetch("/api/brand", {
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error);
        }

        if (!cancelled) {
          setBrands(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Terjadi kesalahan");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validasi field wajib (sesuaikan dengan kebutuhan Anda, misal brd_nama wajib)
    if (!brdNama) {
      showToast("error", "Brand name is required");
      return;
    }

    try {
      setSaving(true);

      const isEditing = editingId !== null;

      const res = await fetch(
        isEditing ? `/api/brand/${editingId}` : "/api/brand",
        {
          method: isEditing ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            brd_initial: brdInitial,
            brd_nama: brdNama,
            brd_alamat: brdAlamat,
            brd_email: brdEmail,
            brd_notelp: brdNotelp,
            brd_pic1: brdPic1,
            brd_pic2: brdPic2,
            brd_pic3: brdPic3,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      resetForm();
      await fetchBrands(); // Pastikan fungsi fetchBrands sudah didefinisikan

      showToast(
        "success",
        isEditing ? "Brand updated successfully" : "Brand added successfully"
      );
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Terjadi kesalahan"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    const result = await confirmDelete("Delete Brand?");

    if (!result.isConfirmed) return;

    try {
      setError("");

      const res = await fetch(`/api/brand/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to delete brand");
      }

      if (editingId === id) {
        resetForm();
      }

      await fetchBrands();

      showToast("success", "Brand deleted successfully");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan";

      setError(message);
      showToast("error", message);
    }
  }

  async function toggleStatus(id: number, currentStatus: number | null) {
    try {
      const newStatus = currentStatus === 1 ? 2 : 1;

      const res = await fetch(`/api/brand/${id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      await fetchBrands();

      showToast(
        "success",
        newStatus === 1 ? "Brand activated" : "Brand deactivated"
      );
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Something went wrong"
      );
    }
  }

  function handleEdit(brand: Brand) {
    setEditingId(brand.brd_id);

    setBrdInitial(brand.brd_initial ?? "");
    setBrdNama(brand.brd_nama ?? "");
    setBrdAlamat(brand.brd_alamat ?? "");
    setBrdEmail(brand.brd_email ?? "");
    setBrdNotelp(brand.brd_notelp ?? "");
    setBrdPic1(brand.brd_pic1 ?? "");
    setBrdPic2(brand.brd_pic2 ?? "");
    setBrdPic3(brand.brd_pic3 ?? "");

    setError("");
  }

  function resetForm() {
    setEditingId(null);

    setBrdInitial("");
    setBrdNama("");
    setBrdAlamat("");
    setBrdEmail("");
    setBrdNotelp("");
    setBrdPic1("");
    setBrdPic2("");
    setBrdPic3("");

    setError("");
  }

  const indexOfLastData = currentPage * rowsPerPage;
  const indexOfFirstData = indexOfLastData - rowsPerPage;

  const currentBrands = brands.slice(indexOfFirstData, indexOfLastData);

  const totalPages = Math.ceil(brands.length / rowsPerPage);

  // Reset halaman ke 1 jika data berubah (misal setelah hapus/tambah)
  useEffect(() => {
    setCurrentPage(1);
  }, [brands.length]);

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Brand Management
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Data Brand</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage brand identities, contact information, and PIC details from one
          place.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)] items-start">
        <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Form Data Brand
                </h2>
                <p className="text-sm text-slate-500">Create or Update Data</p>
              </div>
            </div>

            <div></div>

            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Initial"
                value={brdInitial}
                onChange={(e) => setBrdInitial(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 px-3"
              />
              <input
                type="text"
                placeholder="Brand Name"
                value={brdNama}
                onChange={(e) => setBrdNama(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 px-3"
              />
            </div>

            <input
              type="text"
              placeholder="Address"
              value={brdAlamat}
              onChange={(e) => setBrdAlamat(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-300 px-3"
            />
            <input
              type="email"
              placeholder="Email"
              value={brdEmail}
              onChange={(e) => setBrdEmail(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-300 px-3"
            />
            <input
              type="tel"
              placeholder="No Telp"
              value={brdNotelp}
              onChange={(e) => setBrdNotelp(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-300 px-3"
            />

            <div className="grid gap-2 sm:grid-cols-3">
              <input
                type="text"
                placeholder="PIC 1"
                value={brdPic1}
                onChange={(e) => setBrdPic1(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 px-3"
              />
              <input
                type="text"
                placeholder="PIC 2"
                value={brdPic2}
                onChange={(e) => setBrdPic2(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 px-3"
              />
              <input
                type="text"
                placeholder="PIC 3"
                value={brdPic3}
                onChange={(e) => setBrdPic3(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 px-3"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}

            <br />

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:bg-slate-400"
              >
                {saving
                  ? "Menyimpan..."
                  : editingId
                  ? "Update Brand"
                  : "Add Brand"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Reset
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                List of Brands
              </h2>
              <p className="text-sm text-slate-500">
                {brands.length} brands total
              </p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              Load data brands...
            </div>
          ) : brands.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              No Have Any Data Brands.
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {currentBrands.map((brand) => (
                <div
                  key={brand.brd_id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {brand.brd_nama} ({brand.brd_initial})
                    </p>
                    <p className="text-sm text-slate-600">{brand.brd_alamat}</p>
                    <p className="text-xs text-slate-500">
                      {brand.brd_email} • {brand.brd_notelp}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(brand)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      Update
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(brand.brd_id)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                    >
                      Delete
                    </button>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          toggleStatus(brand.brd_id, brand.brd_status)
                        }
                        className={`relative h-7 w-14 rounded-full transition-all duration-300 ${
                          brand.brd_status === 1
                            ? "bg-blue-500"
                            : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-300 ${
                            brand.brd_status === 1 ? "left-8" : "left-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
            {/* Dropdown Style: Menyamakan tinggi dan border dengan tombol */}
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="h-10 px-3 pr-8 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white outline-none focus:border-slate-400 transition cursor-pointer appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 0.5rem center",
                backgroundSize: "1.5em",
              }}
            >
              {[5, 10, 25, 50, 100].map((val) => (
                <option key={val} value={val}>
                  Show {val} per page
                </option>
              ))}
            </select>

            {/* Button Pagination Style: Menyamakan dengan style tombol Reset */}
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => prev - 1)}
                className="h-10 px-4 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                Prev
              </button>

              <span className="text-sm font-medium text-slate-500 px-1">
                Page {currentPage} / {Math.max(1, totalPages)}
              </span>

              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((prev) => prev + 1)}
                className="h-10 px-4 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50 max-w-sm">
          <div
            className={`rounded-2xl border px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.16)] backdrop-blur ${
              toast.type === "success"
                ? "border-emerald-200 bg-white/95 text-emerald-700"
                : "border-rose-200 bg-white/95 text-rose-700"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  toast.type === "success" ? "bg-emerald-50" : "bg-rose-50"
                }`}
              >
                {toast.type === "success" ? (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="m5 13 4 4L19 7" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 8v5" />
                    <path d="M12 16h.01" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {toast.type === "success" ? "Success" : "Error"}
                </p>
                <p className="mt-1 text-sm">{toast.message}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
