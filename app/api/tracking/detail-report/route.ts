import { authOptions } from '@/auth';
import { scrapeContentUrl } from '@/lib/apify';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { getContentIdentity } from '@/lib/content-url';

async function authorized() {
  return Boolean((await getServerSession(authOptions))?.user);
}

function imageType(bytes: Buffer, header: string) {
  if (header.startsWith('image/')) return header.split(';')[0];
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  if (bytes.subarray(4, 12).toString().includes('ftypavif')) return 'image/avif';
  return null;
}

async function persistThumbnail(urls: string[], platform: string, contentUrl: string) {
  const referers: Record<string, string> = {
    instagram: 'https://www.instagram.com/', tiktok: 'https://www.tiktok.com/',
    youtube: 'https://www.youtube.com/', twitter: 'https://x.com/',
  };
  const candidates = [...new Set(urls.filter((url) => /^https?:\/\//i.test(url)))];
  for (const url of candidates) try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        Accept: 'image/*,*/*;q=0.8',
        Referer: referers[platform] ?? new URL(contentUrl).origin,
      },
      cache: 'no-store',
    });
    if (!response.ok) continue;
    const bytes = Buffer.from(await response.arrayBuffer());
    const type = imageType(bytes, response.headers.get('content-type') ?? '');
    if (!type || bytes.length === 0 || bytes.length > 5_000_000) continue;
    return `data:${type};base64,${bytes.toString('base64')}`;
  } catch { /* try the next cover */ }

  try {
    const response = await fetch(contentUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' },
      cache: 'no-store',
    });
    const html = await response.text();
    const encoded = html.match(/<meta[^>]+property=[\"']og:image[\"'][^>]+content=[\"']([^\"']+)/i)?.[1]
      ?? html.match(/<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+property=[\"']og:image[\"']/i)?.[1];
    if (encoded) {
      const fallback = encoded.replace(/&amp;/g, '&');
      if (!candidates.includes(fallback)) return persistThumbnail([fallback], platform, contentUrl);
    }
  } catch { /* keep the original CDN URL as final fallback */ }

  return candidates[0] ?? null;
}

function parseIds(values: string[]): number[] {
  return [...new Set(values.flatMap((value) => value.split(',')).map(Number))]
    .filter((id) => Number.isInteger(id) && id > 0);
}

async function getRows(projectId: number, detailIds: number[]) {
  return prisma.dtl_project.findMany({
    where: {
      drf_projectid: projectId,
      ...(detailIds.length ? { drf_id: { in: detailIds } } : {}),
    },
    include: { mst_creators: true, mst_sow: true, detail_report: true },
    orderBy: { drf_id: 'asc' },
  });
}

function serialize(row: Awaited<ReturnType<typeof getRows>>[number]) {
  return {
    detailId: row.drf_id,
    creatorId: row.drf_creatorid,
    creatorName: row.mst_creators.name,
    username: row.mst_creators.username,
    platform: row.mst_creators.social_media,
    followers: row.mst_creators.followers ?? 0,
    photo: row.mst_creators.photo_url,
    sow: row.mst_sow?.sow_nama ?? null,
    contentUrl: row.drf_link_content,
    report: row.detail_report,
  };
}

function displayUsername(value: string | null | undefined) {
  const username = String(value ?? '').trim().replace(/^@+/, '');
  return username ? `@${username}` : 'Creator';
}

export async function GET(request: Request) {
  if (!(await authorized())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const projectId = Number(params.get('projectId'));
  const detailIds = parseIds(params.getAll('detailIds'));
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
  }

  const [project, rows] = await Promise.all([
    prisma.trs_project.findUnique({
      where: { prj_id: projectId },
      include: { mst_brand: true, mst_dbest: true },
    }),
    getRows(projectId, detailIds),
  ]);
  if (!project) return NextResponse.json({ error: 'Project was not found' }, { status: 404 });

  return NextResponse.json({
    project: {
      id: project.prj_id, code: project.prj_kode, brand: project.mst_brand.brd_nama,
      name: project.prj_nama, pic: project.creaby, date: project.prj_renddate,
      dbest: project.mst_dbest ? { name: project.mst_dbest.bst_nama ?? '', address: project.mst_dbest.bst_alamat ?? '' } : null,
    },
    items: rows.map(serialize),
  });
}

export async function POST(request: Request) {
  if (!(await authorized())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null) as { projectId?: unknown; detailIds?: unknown } | null;
  const projectId = Number(body?.projectId);
  const detailIds = Array.isArray(body?.detailIds)
    ? parseIds(body.detailIds.map(String))
    : [];
  if (!Number.isInteger(projectId) || projectId <= 0 || detailIds.length === 0) {
    return NextResponse.json({ error: 'Project ID and selected creators are required' }, { status: 400 });
  }

  const rows = await getRows(projectId, detailIds);
  const results = await Promise.all(rows.map(async (row) => {
    const resultContext = {
      detailId: row.drf_id,
      creator: displayUsername(row.mst_creators.username),
      contentUrl: row.drf_link_content,
    };
    if (!row.drf_link_content) return { ...resultContext, error: 'URL content is empty' };
    try {
      const identity = getContentIdentity(row.drf_link_content, row.mst_creators.social_media);
      console.info('[SCRAPING START]', {
        projectId, creatorId: row.drf_creatorid, detailId: row.drf_id,
        creator: row.mst_creators.username, platform: identity.platform,
        requestedUrl: row.drf_link_content, normalizedUrl: identity.normalizedUrl,
        contentId: identity.contentId,
      });
      const metric = await scrapeContentUrl(row.drf_link_content, row.mst_creators.social_media);
      console.info('[SCRAPING RESULT]', {
        creatorId: row.drf_creatorid, detailId: row.drf_id,
        requestedUrl: identity.normalizedUrl, returnedUrl: metric.scrapedContentUrl,
        requestedContentId: identity.contentId, returnedContentId: metric.contentId,
        match: identity.contentId === metric.contentId,
      });
      const thumbnail = await persistThumbnail(
        metric.thumbnailCandidates ?? (metric.thumbnailUrl ? [metric.thumbnailUrl] : []),
        metric.platform,
        metric.contentUrl,
      );
      const interactions = metric.likes + metric.comments + metric.saves + metric.reposts + metric.shares;
      const performance = metric.views > 0 ? (interactions / metric.views) * 100 : 0;
      await prisma.detail_report.upsert({
        where: { dtl_project_id: row.drf_id },
        update: {
          content_url: metric.contentUrl, platform: metric.platform, caption: metric.caption,
          thumbnail_url: thumbnail, likes: metric.likes, comments: metric.comments,
          saves: metric.saves, reposts: metric.reposts, views: metric.views, plays: metric.plays,
          duration: metric.duration, shares: metric.shares, performance, scraped_at: new Date(),
        },
        create: {
          dtl_project_id: row.drf_id, content_url: metric.contentUrl, platform: metric.platform,
          caption: metric.caption, thumbnail_url: thumbnail, likes: metric.likes,
          comments: metric.comments, saves: metric.saves, reposts: metric.reposts,
          views: metric.views, plays: metric.plays, duration: metric.duration,
          shares: metric.shares, performance,
        },
      });
      console.info('[SCRAPING SAVE]', {
        creatorId: row.drf_creatorid, detailId: row.drf_id,
        contentId: metric.contentId, status: 'saved',
      });
      return { ...resultContext, success: true };
    } catch (error) {
      console.error(`Detail report scraping failed for detail ${row.drf_id}:`, error);
      const message = error instanceof Error ? error.message : 'Scraping failed';
      const isDatabaseError = message.includes('prisma') || message.includes('Invalid value provided');
      return { ...resultContext, error: isDatabaseError ? 'Scraped metadata could not be saved' : message };
    }
  }));

  const refreshed = await getRows(projectId, detailIds);
  return NextResponse.json({ items: refreshed.map(serialize), results }, {
    status: results.some((result) => 'error' in result) ? 207 : 200,
  });
}
