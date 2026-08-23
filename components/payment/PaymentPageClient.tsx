"use client";

import { useEffect, useRef, useState } from "react";
import { confirmDelete } from "@/lib/alert";

type Payment = {
  pyt_id: number;
  pyt_bank: string | null;
  pyt_norek: string | null;
  pyt_nama: string | null;
  pyt_status: number | null;
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
  const [payments, setPayments] = useState<Payment[]>([]);

  const [pytBank, setPytBank] = useState("");
  const [pytNorek, setPytNorek] = useState("");
  const [pytNama, setPytNama] = useState("");
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

  async function fetchPayments() {
    const res = await fetch("/api/payment", {
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error ?? "Failed to load payment accounts");
    }

    setPayments(data);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);

        const res = await fetch("/api/payment", {
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error);
        }

        if (!cancelled) {
          setPayments(data);
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

    if (!pytBank || !pytNorek || !pytNama) {
      showToast("error", "All fields are required");
      return;
    }

    try {
      setSaving(true);

      const isEditing = editingId !== null;

      const res = await fetch(
        isEditing ? `/api/payment/${editingId}` : "/api/payment",
        {
          method: isEditing ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pyt_bank: pytBank,
            pyt_norek: pytNorek,
            pyt_nama: pytNama,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      resetForm();
      await fetchPayments();

      showToast(
        "success",
        isEditing
          ? "Payment account updated successfully"
          : "Payment account added successfully"
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
    const result = await confirmDelete("Delete Payment Account?");

    if (!result.isConfirmed) return;

    try {
      setError("");

      const res = await fetch(`/api/payment/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to delete payment account");
      }

      if (editingId === id) {
        resetForm();
      }

      await fetchPayments();

      showToast("success", "Payment account deleted successfully");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan";

      setError(message);
      showToast("error", message);
    }
  }

  
  async function toggleStatus(id: number, currentStatus: number | null) {
    try {
      const newStatus = currentStatus === 1 ? 2 : 1;

      const res = await fetch(`/api/payment/${id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      await fetchPayments();

      showToast(
        "success",
        newStatus === 1 ? "Payment activated" : "Payment deactivated"
      );
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Something went wrong"
      );
    }
  }

  function handleEdit(payment: Payment) {
    setEditingId(payment.pyt_id);

    setPytBank(payment.pyt_bank ?? "");
    setPytNorek(payment.pyt_norek ?? "");
    setPytNama(payment.pyt_nama ?? "");

    setError("");
  }

  function resetForm() {
    setEditingId(null);

    setPytBank("");
    setPytNorek("");
    setPytNama("");

    setError("");
  }

  // Hitung data yang akan ditampilkan
  const indexOfLastData = currentPage * rowsPerPage;
  const indexOfFirstData = indexOfLastData - rowsPerPage;
  const currentPayments = payments.slice(indexOfFirstData, indexOfLastData);
  const totalPages = Math.ceil(payments.length / rowsPerPage);

  // Reset halaman ke 1 jika data berubah (misal setelah hapus/tambah)
  useEffect(() => {
    setCurrentPage(1);
  }, [payments.length]);

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Payment Management
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Data Payment</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage payment accounts, bank information, and transaction
          destinations from one place.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)] items-start">
        <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Form Data Payment
                </h2>
                <p className="text-sm text-slate-500">Create or Update Data</p>
              </div>
            </div>

            <div></div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Bank Name
              </label>

              <input
                type="text"
                value={pytBank}
                onChange={(e) => setPytBank(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 px-3"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Account Number
              </label>

              <input
                type="text"
                value={pytNorek}
                onChange={(e) => setPytNorek(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 px-3"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Account Holder Name
              </label>

              <input
                type="text"
                value={pytNama}
                onChange={(e) => setPytNama(e.target.value)}
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
                {saving
                  ? "Menyimpan..."
                  : editingId
                  ? "Update User"
                  : "Add User"}
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
                List of Bank Payment
              </h2>
              <p className="text-sm text-slate-500">{payments.length} bank</p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              Memuat data user...
            </div>
          ) : payments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              Belum ada user.
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {currentPayments.map((payment) => (
                <div
                  key={payment.pyt_id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {payment.pyt_bank}
                    </p>

                    <p className="mt-1 text-sm text-slate-600">
                      {payment.pyt_norek}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {payment.pyt_nama}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(payment)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      Update
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(payment.pyt_id)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                    >
                      Delete
                    </button>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          toggleStatus(payment.pyt_id, payment.pyt_status)
                        }
                        className={`relative h-7 w-14 rounded-full transition-all duration-300 ${
                          payment.pyt_status === 1
                            ? "bg-blue-500"
                            : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-300 ${
                            payment.pyt_status === 1 ? "left-8" : "left-1"
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
