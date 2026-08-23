import DefaultLayout from "@/components/Layout/DefaultLayout";
import { requireSession } from "@/lib/session";

export default async function ProfilePage() {
  const session = await requireSession()

  return (
    <DefaultLayout>
      <section className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white/85 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Profile</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">User Profile</h1>
          <p className="mt-2 text-sm text-slate-600">Informasi akun user yang sedang login.</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Name</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{session.user.name || "-"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Email</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{session.user.email}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Role</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{session.user.role}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">User ID</p>
            <p className="mt-2 break-all text-lg font-semibold text-slate-900">{session.user.id}</p>
          </div>
        </div>
      </section>
    </DefaultLayout>
  );
}
