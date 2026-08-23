'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { normalizePlatform, SOCIAL_PLATFORMS } from '@/lib/social-platform';

type Report = {
  caption: string | null; thumbnail_url: string | null; likes: number; comments: number;
  saves: number; reposts: number; views: number; plays: number; duration: number;
  shares: number; performance: number; scraped_at: string;
};
type Item = { detailId: number; creatorName: string; username: string; photo: string | null;
  platform: string; sow: string | null; contentUrl: string | null; report: Report | null };
type Payload = { project: { brand: string | null; name: string; pic: string; date: string | null }; items: Item[] };

const DEFAULT_PROFILE_PHOTO = '/image/default-kol-avatar.png';

function profilePhotoSource(value: string | null | undefined) {
  const url = String(value ?? '').trim();
  if (!url) return DEFAULT_PROFILE_PHOTO;
  if (url.startsWith('/') || url.startsWith('data:')) return url;
  if (!/^https?:\/\//i.test(url)) return DEFAULT_PROFILE_PHOTO;
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

export default function DetailReportClient() {
  const params = useSearchParams();
  const router = useRouter();
  const projectId = Number(params.get('projectId'));
  const rawDetailIds = params.getAll('detailIds').join(',');
  const detailIds = useMemo(() => rawDetailIds.split(',').map(Number)
    .filter((id) => Number.isInteger(id) && id > 0), [rawDetailIds]);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const queryString = useMemo(() => {
    const query = new URLSearchParams({ projectId: String(projectId) });
    detailIds.forEach((id) => query.append('detailIds', String(id)));
    return query.toString();
  }, [projectId, detailIds]);

  const scrape = useCallback(async (ids: number[]) => {
    if (!projectId || ids.length === 0) return;
    setScraping(true); setErrors([]);
    try {
      const response = await fetch('/api/tracking/detail-report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, detailIds: ids }),
      });
      const result = await response.json();
      if (!response.ok && response.status !== 207) throw new Error(result.error ?? 'Failed to scrape content');
      setData((current) => current ? { ...current, items: result.items } : current);
      setErrors((result.results ?? []).filter((item: { error?: string }) => item.error)
        .map((item: { detailId: number; creator?: string; contentUrl?: string | null; error: string }) =>
          `${item.creator ?? `Creator #${item.detailId}`}: ${item.error}${item.contentUrl ? ` (${item.contentUrl})` : ""}`
        ));
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Failed to scrape content']);
    } finally { setScraping(false); }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) { setLoading(false); return; }
    fetch(`/api/tracking/detail-report?${queryString}`, { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Failed to load report');
        setData(result);
      })
      .catch((error) => setErrors([error.message]))
      .finally(() => setLoading(false));
  }, [projectId, queryString]);

  if (loading) return <ReportLoading />;
  if (!projectId) return <Status text="Project ID is missing." />;

  return (
    <div className="space-y-6">
      {data && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Brand Name" value={data.project.brand ?? '-'} />
            <Field label="Project Name" value={data.project.name} />
            <Field label="PIC" value={data.project.pic} />
            <Field label="Report Date" value={data.project.date ? new Date(data.project.date).toLocaleDateString('en-GB', { dateStyle: 'long' }) : '-'} />
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h1 className="text-2xl font-bold sm:text-3xl">Detail Report</h1><p className="mt-1 text-slate-500">Post Performance Analytics</p></div>
          <button disabled={scraping || !data?.items.length} onClick={() => scrape(data?.items.map((item) => item.detailId) ?? [])}
            className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {scraping ? 'Updating data...' : 'Update Data'}
          </button>
        </div>
        {errors.length > 0 && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{errors.map((error) => <p key={error}>{error}</p>)}</div>}
        {!data?.items.length ? <p className="mt-8 rounded-xl border border-dashed p-8 text-center text-slate-500">No creators were selected.</p> :
          <div className="mt-8 space-y-8">{data.items.map((item) => <ReportCard key={item.detailId} item={item} loading={scraping} />)}</div>}
      </section>
      <div className="flex justify-end"><button onClick={() => router.back()} className="rounded-xl bg-black px-6 py-3 text-sm font-semibold text-white">Back to Report</button></div>
    </div>
  );
}

function ReportCard({ item, loading }: { item: Item; loading: boolean }) {
  const report = item.report;
  const platform = normalizePlatform(item.platform);
  const platformInfo = platform ? SOCIAL_PLATFORMS[platform] : null;
  const metrics = report ? [
    { title: 'Performance', raw: report.performance, value: `${report.performance.toFixed(2)}%` },
    { title: 'Likes', raw: report.likes, value: format(report.likes) },
    { title: 'Comments', raw: report.comments, value: format(report.comments) },
    { title: 'Saves', raw: report.saves, value: format(report.saves) },
    { title: 'Repost', raw: report.reposts, value: format(report.reposts) },
    { title: 'Views', raw: report.views, value: format(report.views) },
    { title: 'Play', raw: report.plays, value: format(report.plays) },
    { title: 'AVG Duration View', raw: report.duration, value: `${report.duration.toFixed(report.duration % 1 ? 1 : 0)} seconds` },
    { title: 'Share', raw: report.shares, value: format(report.shares) },
  ].filter((metric) => metric.raw > 0) : [];
  const fallbackImage = '/image/default-kol-avatar.png';
  return (
    <article className="rounded-2xl border border-slate-200 p-4 sm:p-6">
      <div className="mb-5 flex items-center gap-3"><img
        src={profilePhotoSource(item.photo)}
        alt={`Profile photo of ${item.creatorName}`}
        onError={(event) => {
          if (!event.currentTarget.src.endsWith(DEFAULT_PROFILE_PHOTO)) {
            event.currentTarget.src = DEFAULT_PROFILE_PHOTO;
          }
        }}
        className="h-12 w-12 rounded-full bg-slate-100 object-cover"
      />
        <div><h2 className="font-bold text-slate-900">{item.creatorName}</h2><p className="text-sm text-slate-500">@{item.username.replace(/^@+/, '')} · {platformInfo?.label ?? item.platform}{item.sow ? ` · ${item.sow}` : ''}</p></div>
      </div>
      {!item.contentUrl ? <p className="rounded-xl bg-amber-50 p-4 text-amber-800">URL Content has not been entered.</p> : !report ?
        <p className="rounded-xl bg-slate-50 p-4 text-slate-500">{loading ? 'Fetching metadata from URL...' : 'Metadata is not available. Click Update Data to fetch it.'}</p> :
        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
          <a href={item.contentUrl} target="_blank" rel="noreferrer" className="group relative flex min-h-72 self-start items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2">
            <img src={thumbnailSource(report.thumbnail_url, fallbackImage)} alt={`Content by ${item.creatorName}`}
              data-fallback={fallbackImage}
              onError={(event) => {
                const fallback = event.currentTarget.dataset.fallback ?? '/image/default-kol-avatar.png';
                if (event.currentTarget.src !== new URL(fallback, window.location.origin).href) event.currentTarget.src = fallback;
              }}
              className="max-h-[560px] w-full rounded-xl object-contain transition duration-300 group-hover:scale-[1.01]" />
            <span className="absolute bottom-3 left-3 rounded-lg bg-black/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">Open content</span>
          </a>
          <div><h3 className="mb-3 text-lg font-bold">Caption</h3><div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 p-4 text-sm">{report.caption || '-'}</div>
            {metrics.length > 0 && <><h3 className="mb-4 mt-7 text-lg font-bold">Performance</h3><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{metrics.map((metric) => <Metric key={metric.title} title={metric.title} value={metric.value} />)}</div></>}
            <p className="mt-4 text-xs text-slate-400">Last fetched {new Date(report.scraped_at).toLocaleString('en-GB')}</p></div>
        </div>}
    </article>
  );
}
function Metric({ title, value }: { title: string; value: string }) { return <div className="rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">{title}</p><p className="mt-1 text-lg font-bold">{value}</p></div>; }
function Field({ label, value }: { label: string; value: string }) { return <div><p className="text-sm font-semibold text-slate-400">{label}</p><p className="mt-2 rounded-xl border bg-slate-50 px-4 py-3 text-sm font-medium">{value}</p></div>; }
function Status({ text }: { text: string }) { return <div className="rounded-2xl border bg-white p-10 text-center text-slate-500">{text}</div>; }
function format(value: number) { return new Intl.NumberFormat('en-US').format(value); }
function thumbnailSource(url: string | null, fallback: string) {
  return url?.startsWith('data:image/')
    ? url
    : url ? `/api/tracking/detail-report/thumbnail?url=${encodeURIComponent(url)}` : fallback;
}

function ReportLoading() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white px-8 py-10 text-center shadow-[0_24px_70px_rgba(15,23,42,0.10)]">
        <div className="relative mx-auto h-16 w-16">
          <div className="absolute inset-0 rounded-full border-4 border-sky-100" />
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-sky-600 border-r-sky-400" />
          <div className="absolute inset-[18px] rounded-full bg-sky-50" />
        </div>
        <h1 className="mt-6 text-xl font-bold text-slate-900">Preparing Detail Report</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500">
          Collecting content metadata and performance metrics from the selected creators.
        </p>
        <div className="mx-auto mt-7 flex max-w-[240px] gap-2">
          {[0, 1, 2].map((index) => (
            <span key={index} className="h-1.5 flex-1 animate-pulse rounded-full bg-sky-200"
              style={{ animationDelay: `${index * 180}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
