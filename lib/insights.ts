// Pure, dependency-free helpers for turning scraped posts
// into profile insights.

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

  return Array.from(matches, (match) => match[1].toLowerCase());
}

export function extractMentions(caption: string): string[] {
  const matches = (caption ?? "").matchAll(MENTION_REGEX);

  return Array.from(matches, (match) => match[1].toLowerCase());
}

function topN<T extends string>(
  values: T[],
  limit: number
): { key: T; count: number }[] {
  const counts = new Map<T, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({
      key,
      count,
    }));
}

export function filterPostsByRange<T extends RawPostLike>(
  posts: T[],
  days: number
): T[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  return posts.filter((post) => {
    const postedTime = new Date(post.postedAt).getTime();

    return !Number.isNaN(postedTime) && postedTime >= cutoff;
  });
}

function safeMetric(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }

  return value;
}

function averageOf(
  posts: RawPostLike[],
  pick: (post: RawPostLike) => number | null | undefined
): number {
  if (posts.length === 0) {
    return 0;
  }

  const sum = posts.reduce((total, post) => {
    return total + safeMetric(pick(post));
  }, 0);

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

  /*
   * ========================================
   * AVERAGE SEMUA POST
   * ========================================
   *
   * Digunakan untuk:
   * - Average Likes
   * - Average Comments
   * - Average Shares
   * - Average Saves
   * - Average Reposts
   * - ER by Followers
   * - ER by TalentHub
   *
   * Semua post dalam periode terpilih digunakan,
   * termasuk feed/foto yang tidak mempunyai views.
   */

  const avgLikes = averageOf(posts, (post) => post.likes);

  const avgComments = averageOf(posts, (post) => post.comments);

  const avgShares = averageOf(posts, (post) => post.shares);

  const avgSaves = averageOf(posts, (post) => post.saves);

  const avgReposts = averageOf(posts, (post) => post.reposts);

  /*
   * ========================================
   * POST YANG MEMPUNYAI DATA VIEWS
   * ========================================
   *
   * Hanya digunakan untuk:
   * - Average Views pada kotak performance
   * - ER by Views
   */

  const viewPosts = posts.filter((post) => {
    return safeMetric(post.views) > 0;
  });

  /*
   * Average Views yang ditampilkan pada kotak.
   *
   * Hanya post dengan views > 0 yang digunakan,
   * sehingga feed tanpa data views tidak menurunkan
   * Average Views.
   */

  const avgViews = averageOf(viewPosts, (post) => post.views);

  /*
   * Seluruh komponen pembilang ER by Views
   * harus berasal dari subset yang sama, yaitu
   * viewPosts.
   */

  const avgLikesView = averageOf(viewPosts, (post) => post.likes);

  const avgCommentsView = averageOf(viewPosts, (post) => post.comments);

  const avgSharesView = averageOf(viewPosts, (post) => post.shares);

  const avgSavesView = averageOf(viewPosts, (post) => post.saves);

  const avgRepostsView = averageOf(viewPosts, (post) => post.reposts);

  /*
   * ========================================
   * ER BY FOLLOWERS
   * ========================================
   *
   * Formula:
   *
   * (
   *   avg likes
   *   + avg comments
   *   + avg shares
   *   + avg saves
   *   + avg reposts
   * )
   * ÷ followers
   * × 100
   *
   * Menggunakan semua post dalam periode.
   */

  const engagementAverageAllPosts =
    avgLikes + avgComments + avgShares + avgSaves + avgReposts;

  const erFollowers =
    followers > 0 ? (engagementAverageAllPosts / followers) * 100 : 0;

  /*
   * ========================================
   * ER BY VIEWS
   * ========================================
   *
   * Formula:
   *
   * (
   *   avg likes
   *   + avg comments
   *   + avg shares
   *   + avg saves
   *   + avg reposts
   * )
   * ÷ avg views
   * × 100
   *
   * Seluruh metrik hanya berasal dari post
   * yang mempunyai views > 0.
   */

  const engagementAverageViewPosts =
    avgLikesView +
    avgCommentsView +
    avgSharesView +
    avgSavesView +
    avgRepostsView;

  const erViews =
    avgViews > 0 ? (engagementAverageViewPosts / avgViews) * 100 : 0;

  /*
   * ========================================
   * ER BY TALENTHUB
   * ========================================
   *
   * Formula:
   *
   * (
   *   avg likes
   *   + avg comments
   *   + avg shares
   *   + avg saves
   *   + avg views
   *   + avg reposts
   * )
   * ÷ followers
   *
   * Tidak dikalikan 100.
   *
   * Semua post dalam periode digunakan.
   * Feed tanpa views tetap masuk sebagai post,
   * dengan nilai views = 0.
   */

  const talenthubAverageAllPosts =
    avgLikes + avgComments + avgShares + avgSaves + avgViews + avgReposts;

  const erTalenthub = followers > 0 ? talenthubAverageAllPosts / followers : 0;

  /*
   * ========================================
   * HASHTAGS DAN MENTIONS
   * ========================================
   */

  const allHashtags = posts.flatMap((post) => extractHashtags(post.caption));

  const allMentions = posts.flatMap((post) => extractMentions(post.caption));

  const topHashtags = topN(allHashtags, hashtagLimit).map(({ key, count }) => ({
    tag: key,
    count,
  }));

  const topMentions = topN(allMentions, mentionLimit).map(({ key, count }) => ({
    mention: key,
    count,
  }));

  return {
    // Untuk filter yang kosong, tampilkan 0.
    // Fallback hanya digunakan ketika memang diberikan
    // dari proses perhitungan profile utama.
    totalPosts: postCount > 0 ? postCount : totalPostFallback,

    avgLikes: Math.round(avgLikes),

    avgComments: Math.round(avgComments),

    // Average Views yang ditampilkan tetap berdasarkan
    // post yang mempunyai data views.
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
  profile: {
    followers: number;
    totalPost: number;
    posts: RawPostLike[];
  },
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
