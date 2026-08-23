function parseJsonArray(value: any) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

export function calculateCreatorInsight(posts: any[], followers: number) {
  const total = posts.length;

  if (total === 0) {
    return {
      avgLikes: 0, avgComments: 0, avgViews: 0,
      avgShares: 0, avgSaves: 0, avgReposts: 0,
      erFollowers: 0, erViews: 0, erTalenthub: 0,
    };
  }

  let likes = 0, comments = 0, views = 0, shares = 0, saves = 0, reposts = 0;
  const hashtagMap: any = {};
  const mentionMap: any = {};

  // khusus buat ER Views: cuma post yang PUNYA views (video/reel) yang ikut
  // dihitung, baik di pembilang maupun penyebut. Post foto (views = 0)
  // tidak ikut sama sekali, biar rata-rata gak ke-drag ke bawah.
  let viewPostCount = 0;
  let viewLikes = 0, viewComments = 0, viewSaves = 0, viewShares = 0, viewViews = 0;

  posts.forEach((post) => {
    const postLikes = post.likes ?? 0;
    const postComments = post.comments ?? 0;
    const postViews = post.views ?? 0;
    const postShares = post.shares ?? 0;
    const postSaves = post.saves ?? 0;
    const postReposts = post.reposts ?? 0;

    likes += postLikes;
    comments += postComments;
    views += postViews;
    shares += postShares;
    saves += postSaves;
    reposts += postReposts;

    if (postViews > 0) {
      viewPostCount++;
      viewLikes += postLikes;
      viewComments += postComments;
      viewSaves += postSaves;
      viewShares += postShares;
      viewViews += postViews;
    }

    parseJsonArray(post.hashtags).forEach((item: any) => {
      if (item.tag) hashtagMap[item.tag] = (hashtagMap[item.tag] ?? 0) + 1;
    });
    parseJsonArray(post.mentions).forEach((item: any) => {
      if (item.mention) mentionMap[item.mention] = (mentionMap[item.mention] ?? 0) + 1;
    });
  });

  const avgLikes = Math.round(likes / total);
  const avgComments = Math.round(comments / total);
  const avgViews = Math.round(views / total);
  const avgShares = Math.round(shares / total);
  const avgSaves = Math.round(saves / total);
  const avgReposts = Math.round(reposts / total);

  // ER Followers: (avg likes+comments+saves+shares) / followers × 100
  const erFollowers =
    followers > 0
      ? ((likes + comments + saves + shares) / total / followers) * 100
      : 0;

  // ER Views: FIX — total sudah saling coret (sum/sum), jangan dibagi lagi.
  // Dan cuma pakai post yang punya views.
  const erViews =
    viewPostCount > 0 && viewViews > 0
      ? ((viewLikes + viewComments + viewSaves + viewShares) / viewViews) * 100
      : 0;

  // Talenthub: (avg likes+comments+shares+saves+views) / followers × 100
  const erTalenthub =
    followers > 0
      ? ((likes + comments + shares + saves + views) / total / followers) * 100
      : 0;

  const topHashtags = Object.entries(hashtagMap)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 10);

  const topMentions = Object.entries(mentionMap)
    .map(([mention, count]) => ({ mention, count }))
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 10);

  return {
    avgLikes, avgComments, avgViews,
    avgShares, avgSaves, avgReposts,
    erFollowers: Number(erFollowers.toFixed(2)),
    erViews: Number(erViews.toFixed(2)),
    erTalenthub: Number(erTalenthub.toFixed(2)),
    topHashtags, topMentions,
  };
}