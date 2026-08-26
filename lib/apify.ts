import type { SocialPlatform } from "./social-platform";
import { contentIdentityMatches, getContentIdentity } from "./content-url";
import { withApifyClient } from "./apify-token-pool";

export interface RawPost {
  caption: string;
  likes: number;
  comments: number;
  views?: number;
  shares?: number;
  saves?: number;
  reposts?: number;
  postedAt: string;
  postUrl: string;
  thumbnailUrl?: string;
  locationName?: string;

  // Dipakai untuk memastikan post memang milik creator.
  ownerUsername?: string;
}

export interface RawProfile {
  username: string;
  socialMedia: "instagram" | "tiktok";
  followers: number;
  following: number;
  totalPost: number;
  photoUrl?: string;
  photoUrls?: string[];
  bio?: string;
  posts: RawPost[];
  isValid: boolean;
}

function normalizeCount(value: unknown): number {
  const number = Number(value);

  // Instagram mengirim -1 jika like disembunyikan
  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return Math.round(number);
}

// ============================================================================
// ENRICHMENT — scrape ulang tiap URL post lewat scrapeContentUrl supaya
// views/shares/saves/reposts AKURAT. Bulk scraper (apify/instagram-scraper
// & clockworks/tiktok-scraper mode `profiles`) TIDAK reliable untuk field
// ini — Instagram malah sama sekali nggak ngasih shares/saves di bulk mode.
// ============================================================================

// Jeda antar scrape ulang per-URL biar nggak langsung kena rate limit.
const PER_URL_SCRAPE_DELAY_MS = 1200;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Scrape ulang SATU post lewat scrapeContentUrl (identity-verified) dan
// gabungkan hasilnya dengan `postedAt`/`locationName` yang cuma tersedia
// dari listing bulk. Kalau gagal (post dihapus, dsb), fallback ke data
// bulk apa adanya supaya satu post gagal tidak menggagalkan seluruh batch.
async function enrichPostFromContentUrl(
  fallback: RawPost,
  platform: "instagram" | "tiktok"
): Promise<{ post: RawPost; enriched: boolean }> {
  if (!fallback.postUrl) return { post: fallback, enriched: false };

  try {
    const metrics = await scrapeContentUrl(fallback.postUrl, platform);
    return {
      enriched: true,
      post: {
        caption: metrics.caption || fallback.caption,
        likes: metrics.likes,
        comments: metrics.comments,
        views: metrics.views,
        shares: metrics.shares,
        saves: metrics.saves,
        reposts: metrics.reposts,
        postedAt: fallback.postedAt,
        postUrl: metrics.scrapedContentUrl || fallback.postUrl,
        thumbnailUrl: metrics.thumbnailUrl ?? fallback.thumbnailUrl,
        locationName: fallback.locationName,
      },
    };
  } catch (err) {
    console.error(
      `  [WARN] gagal scrape ulang detail post ${fallback.postUrl}:`,
      err
    );
    return { post: fallback, enriched: false };
  }
}

// Enrich SEMUA post dalam array secara berurutan (dengan jeda antar
// panggilan) supaya nggak langsung kena rate limit di actor per-URL.
// Sengaja LEMPAR ERROR kalau semua post gagal di-enrich — supaya gagal
// diam-diam (fallback ke data bulk yang shares/saves/reposts-nya 0) tidak
// pernah terjadi tanpa disadari di pipeline pemanggilnya.
// ganti enrichPosts lama dengan versi ber-concurrency
export async function enrichPosts(
  posts: RawPost[],
  platform: "instagram" | "tiktok",
  options: {
    concurrency?: number;
    dropFailed?: boolean;
  } = {}
): Promise<RawPost[]> {
  const {
    concurrency = 5,
    dropFailed = false,
  } = options;

  if (posts.length === 0) {
    return [];
  }

  const results: Array<{
    post: RawPost;
    enriched: boolean;
  } | null> = new Array(posts.length).fill(null);

  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor++;

      if (index >= posts.length) {
        return;
      }

      results[index] =
        await enrichPostFromContentUrl(
          posts[index],
          platform
        );
    }
  }

  const workerCount = Math.min(
    Math.max(1, concurrency),
    posts.length
  );

  await Promise.all(
    Array.from(
      { length: workerCount },
      () => worker()
    )
  );

  const completedResults = results.filter(
    (
      result
    ): result is {
      post: RawPost;
      enriched: boolean;
    } => result !== null
  );

  const successCount = completedResults.filter(
    (result) => result.enriched
  ).length;

  console.log(
    `  [ENRICH] ${platform}: ${successCount}/${posts.length} post berhasil diverifikasi (concurrency=${workerCount})`
  );

  // Mode strict untuk Quick Search:
  // hasil yang gagal diverifikasi tidak dikembalikan.
  if (dropFailed) {
    return completedResults
      .filter((result) => result.enriched)
      .map((result) => result.post);
  }

  // Mode biasa untuk background pipeline:
  // post gagal memakai data bulk.
  if (posts.length > 0 && successCount === 0) {
    throw new Error(
      `Enrichment gagal total untuk ${posts.length} post (platform: ${platform})`
    );
  }

  return completedResults.map(
    (result) => result.post
  );
}


// BARU: bulk fetch instagram posts TANPA enrichment — dipakai buat quick search
// biar cek Indonesia bisa jalan duluan sebelum buang waktu enrich.
export async function fetchInstagramBulkPosts(
  username: string,
  sinceDate?: Date,
  candidateLimit = 40
): Promise<RawPost[]> {
  const normalizedUsername = username
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();

  return withApifyClient(async (client) => {
    const input: Record<string, unknown> = {
      directUrls: [
        `https://www.instagram.com/${normalizedUsername}/`,
      ],
      resultsType: "posts",
      resultsLimit: candidateLimit,
    };

    if (sinceDate) {
      input.onlyPostsNewerThan = sinceDate
        .toISOString()
        .slice(0, 10);
    }

    const run = await client
      .actor("apify/instagram-scraper")
      .call(input);

    const { items } = await client
      .dataset(run.defaultDatasetId)
      .listItems();

    const seenContentIds = new Set<string>();

    const posts = (items as any[])
      .map((item): RawPost | null => {
        const ownerUsername = String(
          item.ownerUsername ??
            item.owner?.username ??
            item.user?.username ??
            item.author?.username ??
            ""
        )
          .trim()
          .replace(/^@+/, "")
          .toLowerCase();

        // Kalau Actor menyediakan informasi owner,
        // owner wajib sama dengan creator yang dicari.
        if (
          ownerUsername &&
          ownerUsername !== normalizedUsername
        ) {
          console.warn(
            `  [BULK] Post dibuang karena owner berbeda: ${ownerUsername} !== ${normalizedUsername}`
          );

          return null;
        }

        const shortCode = String(
          item.shortCode ??
            item.shortcode ??
            item.code ??
            ""
        ).trim();

        const postUrl = String(
          item.url ??
            item.postUrl ??
            (shortCode
              ? `https://www.instagram.com/p/${shortCode}/`
              : "")
        ).trim();

        const postedAt = String(
          item.timestamp ??
            item.takenAtIso ??
            item.taken_at ??
            ""
        ).trim();

        if (!postUrl || !postedAt) {
          return null;
        }

        let contentIdentity: string;

        try {
          const identity = getContentIdentity(
            postUrl,
            "instagram"
          );

          contentIdentity =
            identity.contentId ??
            identity.normalizedUrl;
        } catch {
          console.warn(
            `  [BULK] URL post tidak valid dan dibuang: ${postUrl}`
          );

          return null;
        }

        if (seenContentIds.has(contentIdentity)) {
          return null;
        }

        seenContentIds.add(contentIdentity);

        return {
          caption: item.caption ?? "",

          likes: normalizeCount(
            item.likesCount ??
              item.likeCount ??
              item.likes
          ),

          comments: normalizeCount(
            item.commentsCount ??
              item.commentCount ??
              item.comments
          ),

          views: normalizeCount(
            item.videoViewCount ??
              item.videoPlayCount ??
              item.viewsCount ??
              item.views
          ),

          shares: normalizeCount(
            item.shareCount ??
              item.sharesCount ??
              item.shares
          ),

          saves: normalizeCount(
            item.saveCount ??
              item.savesCount ??
              item.saves
          ),

          reposts: normalizeCount(
            item.repostCount ??
              item.repostsCount ??
              item.reposts
          ),

          postedAt,
          postUrl,

          thumbnailUrl:
            item.displayUrl ??
            item.display_url ??
            item.thumbnailUrl,

          locationName: item.locationName,

          ownerUsername:
            ownerUsername || undefined,
        };
      })
      .filter(
        (post): post is RawPost =>
          post !== null
      )
      .sort(
        (a, b) =>
          new Date(b.postedAt).getTime() -
          new Date(a.postedAt).getTime()
      );

    console.log(
      `  [BULK] ${normalizedUsername}: ${posts.length}/${items.length} kandidat lolos filter awal`
    );

    return posts;
  });
}


// ============================================================================
// INSTAGRAM — PROFIL SAJA (murah, TIDAK ikut narik postingan)
// ============================================================================
//
// Dipakai untuk validasi cepat (valid/invalid, jumlah follower) sebelum
// memutuskan apakah perlu lanjut narik postingan lewat scrapeInstagramPosts
// (yang jauh lebih berat karena scrape ulang per-URL).
export async function scrapeInstagramProfileDetails(
  usernames: string[]
): Promise<RawProfile[]> {
  if (usernames.length === 0) return [];

  const rawItems = await withApifyClient(async (client) => {
    const run = await client.actor("apify/instagram-scraper").call({
      directUrls: usernames.map((u) => `https://www.instagram.com/${u}/`),
      resultsType: "details",
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    return items as any[];
  });

  return rawItems.map((item) => {
    const photoUrls = imageUrls(
      item.profilePicUrlHD,
      item.profilePicUrl,
      item.profile_pic_url_hd,
      item.profile_pic_url
    );

    return {
      username: item.username,
      socialMedia: "instagram" as const,
      followers: item.followersCount ?? 0,
      following: item.followsCount ?? 0,
      totalPost: item.postsCount ?? 0,
      photoUrl: photoUrls[0],
      photoUrls,
      bio: item.biography,
      posts: [], // sengaja kosong — belum di-scrape di titik ini
      isValid: !item.error,
    };
  });
}

// ============================================================================
// INSTAGRAM — POSTINGAN (dipanggil belakangan, untuk akun yang sudah lolos
// filter follower)
// ============================================================================
//
// Tahap 1 (bulk, murah): dapetin daftar URL post + postedAt + locationName.
// Tahap 2: tiap URL di-scrape ULANG lewat scrapeContentUrl (identity
// verified) untuk metrik engagement yang akurat — INI WAJIB JALAN, jangan
// pernah dilewati, karena bulk mode Instagram tidak ngasih shares/saves.
export async function scrapeInstagramPosts(
  username: string,
  sinceDate?: Date,
  limit = 20
): Promise<RawPost[]> {
  const bulkPosts = await withApifyClient(async (client) => {
    const input: Record<string, any> = {
      directUrls: [`https://www.instagram.com/${username}/`],
      resultsType: "posts",
      resultsLimit: limit,
    };

    if (sinceDate) {
      // Format yang diterima actor: YYYY-MM-DD.
      input.onlyPostsNewerThan = sinceDate.toISOString().slice(0, 10);
    }

    const run = await client.actor("apify/instagram-scraper").call(input);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    return (items as any[]).slice(0, limit).map((p: any) => ({
      caption: p.caption ?? "",
      likes: normalizeCount(p.likesCount ?? p.likeCount ?? p.likes),
      comments: normalizeCount(
        p.commentsCount ?? p.commentCount ?? p.comments
      ),
      views: normalizeCount(p.videoViewCount ?? p.viewsCount ?? p.views),
      shares: normalizeCount(p.shareCount ?? p.sharesCount ?? p.shares),
      saves: normalizeCount(p.saveCount ?? p.savesCount ?? p.saves),
      reposts: normalizeCount(p.repostCount ?? p.repostsCount ?? p.reposts),
      postedAt: p.timestamp ?? p.takenAtIso ?? new Date().toISOString(),
      // FIX: `p.url ?? p.shortCode ? A : B` tanpa kurung salah presedensi
      // (?? lebih tinggi dari ?:), jadi kebaca (p.url ?? p.shortCode) ? A : B
      // -> p.url malah ke-skip. Sekarang eksplisit dikurung.
      postUrl:
        p.url ??
        (p.shortCode ? `https://www.instagram.com/p/${p.shortCode}/` : ""),
      thumbnailUrl: p.displayUrl ?? p.display_url,
      locationName: p.locationName,
    })) as RawPost[];
  });

  return enrichPosts(bulkPosts, "instagram");
}

// Dipertahankan untuk kompatibilitas — profil + posts sekaligus dalam SATU
// pemanggilan (misalnya untuk pemanggil yang belum pakai flow 2 tahap).
export async function scrapeInstagramProfiles(
  usernames: string[]
): Promise<RawProfile[]> {
  const profiles = await scrapeInstagramProfileDetails(usernames);
  const results: RawProfile[] = [];
  for (const profile of profiles) {
    if (!profile.isValid) {
      results.push(profile);
      continue;
    }
    const posts = await scrapeInstagramPosts(profile.username);
    results.push({ ...profile, posts });
  }
  return results;
}

// ============================================================================
// TIKTOK — PROFIL + POSTINGAN SEKALIGUS
// ============================================================================
//
// Actor TikTok (`clockworks/tiktok-scraper` mode `profiles`) memang balikin
// info author + list post dalam satu run yang sama, jadi tidak dipisah jadi
// 2 fungsi seperti Instagram. Sama seperti IG, listing bulk cuma dipakai
// buat dapetin URL+postedAt, lalu tiap post di-scrape ulang lewat
// scrapeContentUrl untuk metrik yang akurat.
//
// enrichPosts: false -> khusus dipakai validateUsernames (cek valid/invalid
// doang), supaya nggak buang kuota Apify buat enrich post yang datanya
// nggak dipakai sama sekali di situ.
export async function scrapeTiktokProfiles(
  usernames: string[],
  sinceDate?: Date,
  resultsPerPage = 20,
  options: { enrichPosts?: boolean } = {}
): Promise<RawProfile[]> {
  if (usernames.length === 0) return [];
  const { enrichPosts: shouldEnrich = true } = options;

  const items = await withApifyClient(async (client) => {
    const run = await client.actor("clockworks/tiktok-scraper").call({
      profiles: usernames,
      resultsPerPage,
      shouldDownloadCovers: false,
      shouldDownloadVideos: false,
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    return items as any[];
  });

  const cutoffMs = sinceDate ? sinceDate.getTime() : null;
  const grouped = new Map<string, any[]>();

  for (const item of items) {
    const key = item.authorMeta?.name;
    if (!key) continue;

    if (cutoffMs !== null) {
      const postedAtMs = new Date(item.createTimeISO).getTime();
      const isWithinRange = !isNaN(postedAtMs) && postedAtMs >= cutoffMs;
      if (!isWithinRange) continue;
    }

    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }

  const profiles: RawProfile[] = [];

  for (const [username, groupedPosts] of grouped.entries()) {
    const author = groupedPosts[0].authorMeta;
    const photoUrls = imageUrls(
      author.avatarLarger,
      author.avatarMedium,
      author.avatarThumb,
      author.avatar,
      author.avatarLargerUrl,
      author.avatarMediumUrl
    );

    const bulkPosts: RawPost[] = groupedPosts.map((p: any) => ({
      caption: p.text ?? "",
      likes: normalizeCount(p.diggCount ?? p.stats?.diggCount),
      comments: normalizeCount(p.commentCount ?? p.stats?.commentCount),
      views: normalizeCount(p.playCount ?? p.stats?.playCount),
      shares: normalizeCount(p.shareCount ?? p.stats?.shareCount),
      saves: normalizeCount(p.collectCount ?? p.stats?.collectCount),
      reposts: normalizeCount(p.repostCount ?? p.stats?.repostCount),
      postedAt: p.createTimeISO,
      postUrl: p.webVideoUrl,
      thumbnailUrl: p.videoMeta?.coverUrl ?? p.videoMeta?.originalCoverUrl,
    }));

    const posts = shouldEnrich
      ? await enrichPosts(bulkPosts, "tiktok")
      : bulkPosts;

    profiles.push({
      username,
      socialMedia: "tiktok" as const,
      followers: author.fans ?? 0,
      following: author.following ?? 0,
      totalPost: author.video ?? 0,
      photoUrl: photoUrls[0],
      photoUrls,
      bio: author.signature,
      posts,
      isValid: true,
    });
  }

  return profiles;
}

// Validasi username doang -> jangan enrich, buang-buang kuota kalau
// hasilnya nggak dipakai.
export async function validateUsernames(
  usernames: string[],
  platform: "instagram" | "tiktok"
): Promise<{ username: string; valid: boolean }[]> {
  if (usernames.length === 0) return [];

  const profiles =
    platform === "instagram"
      ? await scrapeInstagramProfileDetails(usernames) // IG: profil doang, memang gak ada posts
      : await scrapeTiktokProfiles(usernames, undefined, 20, {
          enrichPosts: false,
        });

  const foundUsernames = new Set(
    profiles.filter((p) => p.isValid).map((p) => p.username.toLowerCase())
  );

  return usernames.map((u) => ({
    username: u,
    valid: foundUsernames.has(u.toLowerCase()),
  }));
}

// ---- Sisanya (ContentMetrics, scrapeContentUrl, resolveShortUrl, dst)
//      TIDAK berubah dari versi kamu sebelumnya — biarkan apa adanya. ----

export interface ContentMetrics {
  contentUrl: string;
  scrapedContentUrl: string;
  contentId: string;
  platform: SocialPlatform;
  caption: string;
  thumbnailUrl?: string;
  thumbnailCandidates?: string[];
  likes: number;
  comments: number;
  saves: number;
  reposts: number;
  views: number;
  plays: number;
  duration: number;
  shares: number;
}

function int(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function imageUrls(...values: unknown[]): string[] {
  const result: string[] = [];
  const visit = (value: unknown) => {
    if (typeof value === "string") {
      if (/^https?:\/\//i.test(value)) result.push(value);
      return;
    }
    if (Array.isArray(value)) return value.forEach(visit);
    if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  values.forEach(visit);
  return [...new Set(result)];
}

function returnedContentUrl(
  item: Record<string, unknown>,
  platform: SocialPlatform
): string | null {
  const text = (...keys: string[]) => {
    const value = keys
      .map((key) => item[key])
      .find(
        (candidate) =>
          typeof candidate === "string" || typeof candidate === "number"
      );
    return value === undefined ? null : String(value);
  };
  const candidates =
    platform === "instagram"
      ? [
          text("inputUrl"),
          text("postUrl"),
          text("permalink"),
          text("shortcode", "code")
            ? `https://instagram.com/reel/${text("shortcode", "code")}/`
            : null,
          text("url"),
        ]
      : platform === "tiktok"
      ? [
          text("inputUrl"),
          text("postUrl"),
          text("webVideoUrl"),
          text("id", "aweme_id")
            ? `https://tiktok.com/@unknown/video/${text("id", "aweme_id")}/`
            : null,
          text("url"),
        ]
      : platform === "youtube"
      ? [
          text("inputUrl"),
          text("videoUrl"),
          text("id", "videoId")
            ? `https://youtube.com/watch?v=${text("id", "videoId")}`
            : null,
          text("url"),
        ]
      : [
          text("inputUrl"),
          text("tweetUrl"),
          text("id", "tweetId")
            ? `https://x.com/i/status/${text("id", "tweetId")}/`
            : null,
          text("url"),
        ];
  return (
    candidates.find(
      (candidate): candidate is string =>
        typeof candidate === "string" && /^https?:\/\//i.test(candidate)
    ) ?? null
  );
}

async function resolveShortUrl(value: string): Promise<string> {
  const identity = getContentIdentity(value);
  if (!identity.isShortUrl) return identity.normalizedUrl;
  try {
    const response = await fetch(identity.normalizedUrl, {
      method: "HEAD",
      redirect: "follow",
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    return response.url || identity.normalizedUrl;
  } catch {
    return identity.normalizedUrl;
  }
}

export async function scrapeContentUrl(
  value: string,
  expectedPlatform?: string | null
): Promise<ContentMetrics> {
  const resolvedUrl = await resolveShortUrl(value);
  const requested = getContentIdentity(resolvedUrl, expectedPlatform);
  const contentUrl = requested.normalizedUrl;
  const platform = requested.platform;
  return withApifyClient(async (client) => {
    const run =
      platform === "instagram"
        ? await client
            .actor("data-slayer/instagram-post-details")
            .call({ urls: [contentUrl] })
        : platform === "tiktok"
        ? await client.actor("clockworks/tiktok-scraper").call({
            postURLs: [contentUrl],
            scrapeRelatedVideos: false,
            resultsPerPage: 1,
            shouldDownloadCovers: true,
          })
        : platform === "youtube"
        ? await client.actor("streamers/youtube-scraper").call({
            startUrls: [{ url: contentUrl }],
            maxResults: 1,
            maxResultsShorts: 1,
            maxResultStreams: 0,
            downloadSubtitles: false,
          })
        : await client.actor("scrapesage/twitter-scraper").call({
            tweetUrls: [contentUrl],
            includeProfile: false,
            includeTweets: true,
            includeReplies: false,
            maxTweetsPerProfile: 1,
          });
    const { items } = await client
      .dataset(run.defaultDatasetId)
      .listItems({ limit: 10 });
    const actorItems = items as Record<string, any>[];
    const matchingItem = actorItems.find((candidate) => {
      const candidateUrl = returnedContentUrl(candidate, platform);
      if (!candidateUrl) return false;
      try {
        return contentIdentityMatches(
          requested,
          getContentIdentity(candidateUrl, platform)
        );
      } catch {
        return false;
      }
    });
    const soleItemWithoutIdentity =
      actorItems.length === 1 && !returnedContentUrl(actorItems[0], platform)
        ? actorItems[0]
        : undefined;
    const item = matchingItem ?? soleItemWithoutIdentity;
    if (!actorItems[0])
      throw new Error("Content could not be found or is not public");
    if (!item) {
      throw new Error("Scraper did not return the exact requested content");
    }
    if (item.error) throw new Error(String(item.error));
    const returnedUrl = returnedContentUrl(item, platform);
    const returned = returnedUrl
      ? getContentIdentity(returnedUrl, platform)
      : requested;
    if (returnedUrl && !contentIdentityMatches(requested, returned))
      throw new Error("Scraper did not return the exact requested content");
    const verifiedContent = {
      scrapedContentUrl: returned.normalizedUrl,
      contentId: requested.contentId ?? returned.contentId ?? "",
    };

    if (platform === "instagram") {
      const metrics = item.metrics ?? {};
      const caption =
        typeof item.caption === "string"
          ? item.caption
          : item.caption?.text ?? item.caption?.text_translation ?? "";
      const plays = int(
        metrics.ig_play_count ??
          metrics.play_count ??
          item.play_count ??
          item.plays_count ??
          item.videoPlayCount
      );
      const thumbnailCandidates = imageUrls(
        item.thumbnail_url,
        item.thumbnailUrl,
        item.display_url,
        item.displayUrl,
        item.image_url,
        item.media_url,
        item.images,
        item.carousel_media,
        item.carouselMedia,
        item.childPosts
      );
      return {
        contentUrl,
        ...verifiedContent,
        platform,
        caption,
        thumbnailUrl: thumbnailCandidates[0],
        thumbnailCandidates,
        likes: int(
          metrics.like_count ??
            item.like_count ??
            item.likesCount ??
            item.likes_count
        ),
        comments: int(
          metrics.comment_count ??
            item.comment_count ??
            item.commentsCount ??
            item.comments_count
        ),
        saves: int(
          metrics.save_count ??
            item.save_count ??
            item.saves_count ??
            item.savesCount
        ),
        reposts: int(
          metrics.repost_count ??
            item.repost_count ??
            item.reposts_count ??
            item.repostsCount
        ),
        views: int(
          metrics.view_count ??
            metrics.ig_play_count ??
            metrics.play_count ??
            item.view_count ??
            item.views_count ??
            item.videoViewCount
        ),
        plays,
        duration:
          Number(item.video_duration ?? item.videoDuration ?? item.duration) ||
          0,
        shares: int(
          metrics.share_count ??
            item.share_count ??
            item.shares_count ??
            item.sharesCount
        ),
      };
    }

    if (platform === "tiktok") {
      const thumbnailCandidates = imageUrls(
        item.videoMeta?.coverUrl,
        item.videoMeta?.originalCoverUrl,
        item.videoMeta?.dynamicCoverUrl,
        item.video?.cover,
        item.video?.originCover,
        item.covers,
        item.cover,
        item.originCover,
        item.dynamicCover,
        item.downloadedCovers,
        item.downloadedCover
      );
      return {
        contentUrl,
        ...verifiedContent,
        platform,
        caption: item.text ?? item.desc ?? "",
        thumbnailUrl: thumbnailCandidates[0],
        thumbnailCandidates,
        likes: int(item.diggCount ?? item.digg_count ?? item.stats?.diggCount),
        comments: int(
          item.commentCount ?? item.comment_count ?? item.stats?.commentCount
        ),
        saves: int(
          item.collectCount ?? item.collect_count ?? item.stats?.collectCount
        ),
        reposts: int(
          item.repostCount ?? item.repost_count ?? item.stats?.repostCount
        ),
        views: int(item.playCount ?? item.play_count ?? item.stats?.playCount),
        plays: int(item.playCount ?? item.play_count ?? item.stats?.playCount),
        duration:
          Number(
            item.videoMeta?.duration ?? item.video?.duration ?? item.duration
          ) || 0,
        shares: int(
          item.shareCount ?? item.share_count ?? item.stats?.shareCount
        ),
      };
    }

    if (platform === "youtube") {
      const thumbnailCandidates = imageUrls(
        item.thumbnailUrl,
        item.thumbnail,
        item.thumbnails,
        item.videoThumbnails,
        item.bestThumbnail,
        item.channelThumbnailUrl
      );
      const views = int(
        item.viewCount ?? item.views ?? item.viewsCount ?? item.stats?.views
      );
      return {
        contentUrl,
        ...verifiedContent,
        platform,
        caption: item.title ?? item.text ?? item.description ?? "",
        thumbnailUrl: thumbnailCandidates[0],
        thumbnailCandidates,
        likes: int(item.likes ?? item.likeCount ?? item.likesCount),
        comments: int(item.commentsCount ?? item.commentCount ?? item.comments),
        saves: 0,
        reposts: 0,
        views,
        plays: views,
        duration:
          Number(item.duration ?? item.durationSeconds ?? item.lengthSeconds) ||
          0,
        shares: 0,
      };
    }

    const metrics = item.metrics ?? item.public_metrics ?? item.stats ?? {};
    const thumbnailCandidates = imageUrls(
      item.thumbnailUrl,
      item.thumbnail,
      item.media,
      item.extendedEntities,
      item.entities?.media,
      item.card?.image,
      item.authorProfile?.profileImageUrl
    );
    const views = int(
      metrics.viewCount ?? metrics.views ?? item.viewCount ?? item.views
    );
    return {
      contentUrl,
      ...verifiedContent,
      platform,
      caption: item.text ?? item.fullText ?? item.full_text ?? item.tweet ?? "",
      thumbnailUrl: thumbnailCandidates[0],
      thumbnailCandidates,
      likes: int(
        metrics.likeCount ??
          metrics.likes ??
          item.likeCount ??
          item.favoriteCount
      ),
      comments: int(metrics.replyCount ?? metrics.replies ?? item.replyCount),
      saves: int(
        metrics.bookmarkCount ?? metrics.bookmarks ?? item.bookmarkCount
      ),
      reposts: int(
        metrics.retweetCount ?? metrics.reposts ?? item.retweetCount
      ),
      views,
      plays: views,
      duration:
        Number(
          item.duration ?? item.video?.duration ?? item.media?.[0]?.duration
        ) || 0,
      shares: int(metrics.quoteCount ?? metrics.quotes ?? item.quoteCount),
    };
  });
}