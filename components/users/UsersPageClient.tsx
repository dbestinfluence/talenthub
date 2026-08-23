"use client";

import { allowedRoles, defaultRole, type AppRole } from "@/lib/roles";
import { useEffect, useRef, useState } from "react";
import { confirmDelete } from "@/lib/alert";

type User = {
  id: string;
  name: string | null;
  email: string;
  phoneNumber: string | null;
  role: AppRole;
};

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

const roleOptions: User["role"][] = [...allowedRoles];

export default function UsersPageClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState<User["role"]>(defaultRole);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const [deleteId, setDeleteId] = useState<string | null>(null);
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

  async function fetchUsers() {
    const res = await fetch("/api/users", { cache: "no-store" });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error ?? "Failed to load users");
    }

    setUsers(data);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch("/api/users", { cache: "no-store" });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load users");
        }

        if (!cancelled) {
          setUsers(data);
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

    loadUsers();

    return () => {
      cancelled = true;
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name || !email || (!password && editingId === null)) {
      const message = "Name, email, and password are required for a new user";
      setError(message);
      showToast("error", message);
      return;
    }

    if (password !== confirmPassword) {
      const message = "Password dan konfirmasi password harus sama";
      setError(message);
      showToast("error", message);
      return;
    }

    try {
      setSaving(true);
      setError("");
      const isEditing = editingId !== null;

      const res = await fetch(
        isEditing ? `/api/users/${editingId}` : "/api/users",
        {
          method: isEditing ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name, email, phoneNumber, password, role }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to save user");
      }

      resetForm();
      await fetchUsers();
      showToast(
        "success",
        isEditing ? "User updated successfully" : "User created successfully"
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan";
      setError(message);
      showToast("error", message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const result = await confirmDelete("Delete User?");

    if (!result.isConfirmed) return;

    try {
      setError("");

      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to delete user");
      }

      if (editingId === id) {
        resetForm();
      }

      await fetchUsers();

      showToast("success", "User deleted successfully");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan";

      setError(message);
      showToast("error", message);
    }
  }

  function handleEdit(user: User) {
    setEditingId(user.id);
    setName(user.name ?? "");
    setEmail(user.email);
    setPhoneNumber(user.phoneNumber ?? "");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setRole(user.role);
    setError("");
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setEmail("");
    setPhoneNumber("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setRole(defaultRole);
  }

  // Hitung data yang akan ditampilkan
  const indexOfLastData = currentPage * rowsPerPage;
  const indexOfFirstData = indexOfLastData - rowsPerPage;
  const currentUsers = users.slice(indexOfFirstData, indexOfLastData);
  const totalPages = Math.ceil(users.length / rowsPerPage);

  // Reset halaman ke 1 jika data berubah (misal setelah hapus/tambah)
  useEffect(() => {
    setCurrentPage(1);
  }, [users.length]);

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
          User Management
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Data Users</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage user accounts, roles, and login credentials from one place.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)] items-start">
        <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Form Data User
                </h2>
                <p className="text-sm text-slate-500">Create or Update Data</p>
              </div>
            </div>

            <div></div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Name
              </label>
              <input
                type="text"
                placeholder="User name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-sky-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                type="email"
                placeholder="email@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-sky-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Phone Number
              </label>
              <input
                type="text"
                placeholder="08xxxxxxxxxx"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-sky-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {editingId ? "Password Baru (opsional)" : "Password"}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={
                    editingId
                      ? "Leave blank to keep the current password"
                      : "Enter password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 pr-11 text-sm outline-none transition focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 transition hover:text-slate-700"
                  aria-label={
                    showPassword ? "Sembunyikan password" : "Tampilkan password"
                  }
                >
                  {showPassword ? (
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M3 3l18 18" />
                      <path d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58" />
                      <path d="M9.88 5.09A9.77 9.77 0 0 1 12 4.8c5.4 0 9 7.2 9 7.2a17.6 17.6 0 0 1-4.11 4.93" />
                      <path d="M6.61 6.61A17.32 17.32 0 0 0 3 12s3.6 7.2 9 7.2a8.9 8.9 0 0 0 2.52-.36" />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M2.5 12S6.1 4.8 12 4.8 21.5 12 21.5 12 17.9 19.2 12 19.2 2.5 12 2.5 12Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {editingId ? "Konfirmasi Password Baru" : "Konfirmasi Password"}
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder={
                    editingId ? "Ulangi password baru" : "Ulangi password"
                  }
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 pr-11 text-sm outline-none transition focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 transition hover:text-slate-700"
                  aria-label={
                    showConfirmPassword
                      ? "Sembunyikan konfirmasi password"
                      : "Tampilkan konfirmasi password"
                  }
                >
                  {showConfirmPassword ? (
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M3 3l18 18" />
                      <path d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58" />
                      <path d="M9.88 5.09A9.77 9.77 0 0 1 12 4.8c5.4 0 9 7.2 9 7.2a17.6 17.6 0 0 1-4.11 4.93" />
                      <path d="M6.61 6.61A17.32 17.32 0 0 0 3 12s3.6 7.2 9 7.2a8.9 8.9 0 0 0 2.52-.36" />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M2.5 12S6.1 4.8 12 4.8 21.5 12 21.5 12 17.9 19.2 12 19.2 2.5 12 2.5 12Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as User["role"])}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-500"
              >
                {roleOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
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
                User List
              </h2>
              <p className="text-sm text-slate-500">
                {users.length} user terdaftar
              </p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              Memuat data user...
            </div>
          ) : users.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              Belum ada user.
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {currentUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">
                        {user.name || "-"}
                      </p>
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                        {user.role}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{user.email}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {user.phoneNumber || "-"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(user)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                     onClick={() => handleDelete(user.id)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                    >
                      Delete
                    </button>
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
