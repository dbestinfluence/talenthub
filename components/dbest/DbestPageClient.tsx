"use client";

import { useEffect, useState } from "react";
import { confirmDelete } from "@/lib/alert";

type Dbest = { bst_id: number; bst_nama: string | null; bst_alamat: string | null; bst_status: number | null };

export default function DbestPageClient() {
  const [items, setItems] = useState<Dbest[]>([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/dbest", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Failed to retrieve DBest data");
      setItems(Array.isArray(result) ? result : []);
      setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Failed to retrieve DBest data"); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);
  const reset = () => { setEditingId(null); setName(""); setAddress(""); setMessage(""); };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !address.trim()) return setMessage("Name and address are required.");
    setSaving(true);
    try {
      const response = await fetch(editingId ? `/api/dbest/${editingId}` : "/api/dbest", { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bst_nama: name, bst_alamat: address }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Failed to save DBest data");
      reset(); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Failed to save DBest data"); }
    finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    if (!(await confirmDelete("Delete DBest data?")).isConfirmed) return;
    const response = await fetch(`/api/dbest/${id}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error ?? "Failed to delete DBest data");
    if (editingId === id) reset();
    await load();
  };

  const toggle = async (item: Dbest) => {
    const response = await fetch(`/api/dbest/${item.bst_id}/status`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: item.bst_status === 1 ? 2 : 1 }) });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error ?? "Failed to update status");
    await load();
  };

  return <section className="space-y-5">
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">DBest Management</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Data DBest</h1>
      <p className="mt-1 text-sm text-slate-600">Manage the company identity used in quotation and invoice documents.</p>
    </div>
    <div className="grid items-start gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
        <div><h2 className="text-lg font-semibold text-slate-900">Form Data DBest</h2><p className="text-sm text-slate-500">Create or Update Data</p></div>
        <label className="block text-sm font-medium text-slate-700">Company Name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3" placeholder="DBest company name" /></label>
        <label className="block text-sm font-medium text-slate-700">Company Address<textarea value={address} onChange={(e) => setAddress(e.target.value)} maxLength={100} rows={4} className="mt-1 w-full resize-none rounded-lg border border-slate-300 px-3 py-2" placeholder="Company address" /></label>
        {message ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{message}</div> : null}
        <div className="flex gap-3"><button disabled={saving} className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:bg-slate-400">{saving ? "Saving..." : editingId ? "Update DBest" : "Add DBest"}</button><button type="button" onClick={reset} className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold">Reset</button></div>
      </form>
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">List of DBest Identities</h2><p className="mb-4 text-sm text-slate-500">{items.length} records</p>
        {loading ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">Loading DBest data...</div> : items.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">No DBest data available.</div> : <div className="space-y-3">{items.map((item) => <div key={item.bst_id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold text-slate-900">{item.bst_nama || "-"}</p><p className="mt-1 text-sm text-slate-500">{item.bst_alamat || "-"}</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => { setEditingId(item.bst_id); setName(item.bst_nama ?? ""); setAddress(item.bst_alamat ?? ""); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Update</button><button type="button" onClick={() => void remove(item.bst_id)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Delete</button><button type="button" aria-label="Toggle DBest status" onClick={() => void toggle(item)} className={`relative h-7 w-14 rounded-full ${item.bst_status === 1 ? "bg-blue-500" : "bg-slate-300"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow ${item.bst_status === 1 ? "left-8" : "left-1"}`} /></button></div></div>)}</div>}
      </div>
    </div>
  </section>;
}
