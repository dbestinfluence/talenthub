// Pure, dependency-free helpers for turning scraped posts into profile
// insights.

export interface RawPostLike {
  caption: string;
  likes: number;
  comments: number;
  views?: number | null;
  shares?: number | null;
  saves?: number | null;
  reposts?: number | null;
  postedAt: string;
  postUrl: string;
  thumbnailUrl?: string;
}

export interface HashtagCount {
  tag: string;
  count: number;
}

export interface MentionCount {
  mention: string;
  count: number;
}

export interface ProfileInsights {
  totalPosts: number;

  avgLikes: number;
  avgComments: number;
  avgViews: number;
  avgShares: number;
  avgSaves: number;
  avgReposts: number;

  // Engagement Rate
  erFollowers: number;
  erViews: number;
  erTalenthub: number;

  topHashtags: HashtagCount[];
  topMentions: MentionCount[];
}

const HASHTAG_REGEX = /#([a-z0-9_]+)/gi;
const MENTION_REGEX = /@([a-z0-9_.]+)/gi;

export function extractHashtags(caption: string): string[] {
  const matches = (caption ?? "").matchAll(HASHTAG_REGEX);
  return Array.from(matches, (m) => m[1].toLowerCase());
}

export function extractMentions(caption: string): string[] {
  const matches = (caption ?? "").matchAll(MENTION_REGEX);
  return Array.from(matches, (m) => m[1].toLowerCase());
}

function topN<T extends string>(
  values: T[],
  n: number
): { key: T; count: number }[] {
  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));
}

export function filterPostsByRange<T extends RawPostLike>(
  posts: T[],
  days: number
): T[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return posts.filter((p) => {
    const t = new Date(p.postedAt).getTime();
    return Number.isNaN(t) ? true : t >= cutoff;
  });
}

function averageOf(
  posts: RawPostLike[],
  pick: (p: RawPostLike) => number | null | undefined
): number {
  if (posts.length === 0) return 0;
  const sum = posts.reduce((total, p) => total + (pick(p) ?? 0), 0);
  return sum / posts.length;
}

export function computeInsightsFromPosts(
  posts: RawPostLike[],
  followers: number,
  totalPostFallback: number,
  hashtagLimit = 10,
  mentionLimit = 5
): ProfileInsights {
  const postCount = posts.length;

  // --- Rata-rata dari SEMUA post: dipakai buat field avg* biasa &
  // erFollowers/erTalenthub (aman karena penyebutnya `followers`, angka
  // TETAP — bukan per-post — jadi nggak ada masalah rasio nyasar). ---
  const avgLikes = averageOf(posts, (p) => p.likes);
  const avgComments = averageOf(posts, (p) => p.comments);
  const avgViews = averageOf(posts, (p) => p.views);
  const avgShares = averageOf(posts, (p) => p.shares);
  const avgSaves = averageOf(posts, (p) => p.saves);
  const avgReposts = averageOf(posts, (p) => p.reposts);

  /*
   * ER by Followers — basis SEMUA post (followers itu angka tetap, jadi
   * rata-rata dulu baru dibagi = sama aja dengan rata-rata per-post).
   */
  const erFollowers =
    followers > 0
      ? ((avgLikes + avgComments + avgShares + avgSaves) / followers) * 100
      : 0;

  /*
   * ER by Views — HARUS dihitung PER-POST dulu baru di-rata-rata, BUKAN
   * (total engagement semua post) / (total views semua post) dan BUKAN
   * juga (rata2 engagement) / (rata2 views).
   *
   * Kenapa: `views` itu beda-beda tiap post (post foto = 0/null, post
   * video/reel = ada angkanya). Kalau dihitung pakai total atau rata-rata
   * gabungan, engagement dari post FOTO (yang nggak punya views) ikut
   * numpuk di pembilang padahal penyebutnya cuma dari post VIDEO —
   * hasilnya bisa jebol ratusan persen.
   *
   * Yang benar: ambil CUMA post yang punya views > 0, hitung ER tiap post
   * itu satu-satu, baru di-rata-rata dari situ.
   *
   *   ER per-post = (likes + comments + shares + saves) / views x 100
   *   erViews     = rata-rata dari semua ER per-post itu
   */
  const viewPosts = posts.filter((p) => (p.views ?? 0) > 0);

  const perPostViewER = viewPosts.map((p) => {
    const engagement =
      (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0) + (p.saves ?? 0);
    return (engagement / (p.views as number)) * 100;
  });

  const erViews =
    perPostViewER.length > 0
      ? perPostViewER.reduce((sum, er) => sum + er, 0) / perPostViewER.length
      : 0;

  /*
   * Talenthub ER — basis SEMUA post, sama alasannya kayak erFollowers
   * (penyebutnya `followers`, angka tetap).
   */
  const erTalenthub =
    followers > 0
      ? ((avgLikes + avgComments + avgShares + avgSaves + avgViews) /
          followers) *
        100
      : 0;

  const allHashtags = posts.flatMap((p) => extractHashtags(p.caption));
  const allMentions = posts.flatMap((p) => extractMentions(p.caption));

  const topHashtags = topN(allHashtags, hashtagLimit).map(
    ({ key, count }) => ({ tag: key, count })
  );
  const topMentions = topN(allMentions, mentionLimit).map(
    ({ key, count }) => ({ mention: key, count })
  );

  return {
    totalPosts: postCount || totalPostFallback,

    avgLikes: Math.round(avgLikes),
    avgComments: Math.round(avgComments),
    avgViews: Math.round(avgViews),
    avgShares: Math.round(avgShares),
    avgSaves: Math.round(avgSaves),
    avgReposts: Math.round(avgReposts),

    erFollowers: Number(erFollowers.toFixed(2)),
    erViews: Number(erViews.toFixed(2)),
    erTalenthub: Number(erTalenthub.toFixed(2)),

    topHashtags,
    topMentions,
  };
}

export function computeProfileInsights(
  profile: { followers: number; totalPost: number; posts: RawPostLike[] },
  hashtagLimit = 10,
  mentionLimit = 5
): ProfileInsights {
  return computeInsightsFromPosts(
    profile.posts,
    profile.followers,
    profile.totalPost,
    hashtagLimit,
    mentionLimit
  );
}