"use client";

import { useEffect, useRef, useState } from "react";
import { confirmDelete } from "@/lib/alert";

type Sow = {
  sow_id: number;
  sow_nama: string | null;
  sow_status: number | null;
  creaby?: string | null;
  creadate?: string | null;
  modiby?: string | null;
  modidate?: string | null;
};

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

export default function PaymentPageClient() {
  const [sows, setSows] = useState<Sow[]>([]);

  const [sowNama, setSowNama] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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

  async function fetchSows() {
    const res = await fetch("/api/sow", {
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error ?? "Failed to load SOW data");
    }

    setSows(data);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);

        const res = await fetch("/api/sow", {
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error);
        }

        if (!cancelled) {
          setSows(data);
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

    if (!sowNama) {
      showToast("error", "All fields are required");
      return;
    }

    try {
      setSaving(true);

      const isEditing = editingId !== null;

      const res = await fetch(
        isEditing ? `/api/sow/${editingId}` : "/api/sow",
        {
          method: isEditing ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sow_nama: sowNama,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      resetForm();
      await fetchSows();

      showToast(
        "success",
        isEditing ? "SOW updated successfully" : "SOW added successfully"
      );
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    const result = await confirmDelete("Delete SOW?");

    if (!result.isConfirmed) return;

    try {
      setError("");

      const res = await fetch(`/api/sow/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to delete SOW");
      }

      if (editingId === id) {
        resetForm();
      }

      await fetchSows();

      showToast("success", "SOW deleted successfully");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan";

      setError(message);
      showToast("error", message);
    }
  }

  async function toggleStatus(id: number, current: number | null) {
    try {
      const newStatus = current === 1 ? 2 : 1;

      const res = await fetch(`/api/sow/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await fetchSows();
      showToast("success", "Status SOW diperbarui");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Error");
    }
  }

  function handleEdit(sow: Sow) {
    setEditingId(sow.sow_id);
    setSowNama(sow.sow_nama ?? "");
    setError("");
  }

  function resetForm() {
    setEditingId(null);
    setSowNama("");
    setError("");
  }

  // Hitung data yang akan ditampilkan
  const indexOfLastData = currentPage * rowsPerPage;
  const indexOfFirstData = indexOfLastData - rowsPerPage;
  const currentSows = sows.slice(indexOfFirstData, indexOfLastData);
  const totalPages = Math.ceil(sows.length / rowsPerPage);

  // Reset halaman ke 1 jika data berubah (misal setelah hapus/tambah)
  useEffect(() => {
    setCurrentPage(1);
  }, [sows.length]);

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
          SOW Management
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Data SOW</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage sow from one place.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)] items-start">
        <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Form Data SOW
                </h2>
                <p className="text-sm text-slate-500">Create or Update Data</p>
              </div>
            </div>

            <div></div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                SOW Name
              </label>

              <input
                type="text"
                value={sowNama}
                onChange={(e) => setSowNama(e.target.value)}
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
                className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {saving ? "Menyimpan..." : editingId ? "Update SOW" : "Add SOW"}
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
                List of SOW
              </h2>
              <p className="text-sm text-slate-500">{sows.length} bank</p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              Memuat data SOW...
            </div>
          ) : sows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              Belum ada SOW.
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {currentSows.map((sow) => (
                <div
                  key={sow.sow_id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="mt-1 text-sm text-slate-500">
                      {sow.sow_nama}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(sow)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      Update
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(sow.sow_id)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      Delete
                    </button>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleStatus(sow.sow_id, sow.sow_status)}
                        className={`relative h-7 w-14 rounded-full transition-all duration-300 ${
                          sow.sow_status === 1 ? "bg-blue-500" : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-300 ${
                            sow.sow_status === 1 ? "left-8" : "left-1"
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
