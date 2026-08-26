import { PrismaClient, Prisma } from "@prisma/client";
import {
  scrapeInstagramProfiles,
  scrapeTiktokProfiles,
  scrapeContentUrl,
  type RawPost,
  type RawProfile,
} from "./apify";
import {
  detectEndorsePosts,
  suggestNewUsernames,
  checkIndonesianLocation,
} from "./gemini";
import { computeInsightsFromPosts } from "./insights";
import { firstProfileImageUrl } from "./profile-image";

const prisma = new PrismaClient();

export interface SeedEntry {
  username: string;
  platform: "instagram" | "tiktok";
  category: string;
}

export interface PersistOptions {
  categoryId?: number | null;
  cityId?: number | null;
  skipPostEnrichment?: boolean;
  replaceStoredPosts?: boolean;
}

const SHARES_SAVES_ENRICHMENT_LIMIT = 20;

function calculateTier(followers: number): string {
  if (followers >= 1_000_000) return "Mega";
  if (followers >= 100_000) return "Macro";
  if (followers >= 10_000) return "Micro";
  return "Nano";
}

function isValidDate(value: string | Date | null | undefined): boolean {
  if (!value) return false;

  const time = new Date(value).getTime();

  return Number.isFinite(time);
}

function safeMetric(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }

  return value;
}

function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

export async function persistCreatorProfile(
  profile: RawProfile,
  options: PersistOptions = {}
): Promise<number> {
  const normalizedProfileUsername = normalizeUsername(profile.username);

  /*
   * Hanya gunakan post yang mempunyai:
   * - URL
   * - tanggal valid
   * - likes/comments valid
   */
  const validPosts = profile.posts.filter((post) => {
    return (
      Boolean(post.postUrl) &&
      isValidDate(post.postedAt) &&
      safeMetric(post.likes) >= 0 &&
      safeMetric(post.comments) >= 0
    );
  });

  /*
   * Deteksi endorsement harus menggunakan post yang
   * benar-benar akan disimpan agar index-nya konsisten.
   */
  const endorseResults = await detectEndorsePosts(profile.username, validPosts);

  const tier = calculateTier(profile.followers);

  const persistedPhoto = firstProfileImageUrl([
    ...(profile.photoUrls ?? []),
    profile.photoUrl,
  ]);

  /*
   * Insight sementara untuk proses upsert creator.
   *
   * Nilai ini nanti ditimpa kembali setelah seluruh post
   * selesai disimpan dan enrichment selesai dilakukan.
   */
  const preliminaryInsights = computeInsightsFromPosts(
    validPosts,
    profile.followers,
    profile.totalPost
  );

  const preliminaryBrandedViews = validPosts
    .filter((_, index) => {
      return (
        endorseResults.find((result) => result.index === index)?.isEndorse ??
        false
      );
    })
    .map((post) => safeMetric(post.views))
    .filter((views) => views > 0);

  const preliminaryAverageBrandView =
    preliminaryBrandedViews.length > 0
      ? Math.round(
          preliminaryBrandedViews.reduce((total, views) => total + views, 0) /
            preliminaryBrandedViews.length
        )
      : 0;

  /*
   * ============================================================
   * UPSERT CREATOR
   * ============================================================
   */

  const creator = await prisma.mst_creators.upsert({
    where: {
      username_social_media: {
        username: normalizedProfileUsername,
        social_media: profile.socialMedia,
      },
    },

    update: {
      name: profile.username,
      username: normalizedProfileUsername,
      followers: profile.followers,
      following: profile.following,
      total_post: profile.totalPost,
      photo_url: persistedPhoto,
      tier,

      average_view: preliminaryInsights.avgViews,
      average_view_brand: preliminaryAverageBrandView,

      avg_likes: preliminaryInsights.avgLikes,
      avg_comments: preliminaryInsights.avgComments,
      avg_shares: preliminaryInsights.avgShares,
      avg_saves: preliminaryInsights.avgSaves,
      avg_reposts: preliminaryInsights.avgReposts,

      er_followers: preliminaryInsights.erFollowers,
      er_views: preliminaryInsights.erViews,
      er_talenthub: preliminaryInsights.erTalenthub,

      top_hashtags:
        preliminaryInsights.topHashtags as unknown as Prisma.InputJsonValue,

      top_mentions:
        preliminaryInsights.topMentions as unknown as Prisma.InputJsonValue,

      ...(options.categoryId != null
        ? {
            category_id: options.categoryId,
          }
        : {}),

      ...(options.cityId != null
        ? {
            city_id: options.cityId,
          }
        : {}),

      last_scraped_at: new Date(),
      updated_at: new Date(),
    },

    create: {
      username: normalizedProfileUsername,
      name: profile.username,

      followers: profile.followers,
      following: profile.following,
      total_post: profile.totalPost,

      photo_url: persistedPhoto,
      social_media: profile.socialMedia,

      tier,
      gender: "unknown",

      category_id: options.categoryId ?? null,
      city_id: options.cityId ?? null,

      average_view: preliminaryInsights.avgViews,
      average_view_brand: preliminaryAverageBrandView,

      avg_likes: preliminaryInsights.avgLikes,
      avg_comments: preliminaryInsights.avgComments,
      avg_shares: preliminaryInsights.avgShares,
      avg_saves: preliminaryInsights.avgSaves,
      avg_reposts: preliminaryInsights.avgReposts,

      er_followers: preliminaryInsights.erFollowers,
      er_views: preliminaryInsights.erViews,
      er_talenthub: preliminaryInsights.erTalenthub,

      top_hashtags:
        preliminaryInsights.topHashtags as unknown as Prisma.InputJsonValue,

      top_mentions:
        preliminaryInsights.topMentions as unknown as Prisma.InputJsonValue,

      last_scraped_at: new Date(),
      updated_at: new Date(),
    },
  });

  /*
   * ============================================================
   * SIMPAN POST
   * ============================================================
   */

  if (options.replaceStoredPosts) {
    const deletedPosts = await prisma.dtl_creator_posts.deleteMany({
      where: {
        creator_id: creator.id,
      },
    });

    console.log(
      `  [CLEANUP] ${deletedPosts.count} post lama ${profile.username} dihapus`
    );
  }

  let savedPosts = 0;

  for (let index = 0; index < validPosts.length; index++) {
    const post = validPosts[index];
    const postedAt = new Date(post.postedAt);

    const isEndorse =
      endorseResults.find((result) => result.index === index)?.isEndorse ??
      false;

    try {
      await prisma.dtl_creator_posts.upsert({
        where: {
          uq_creator_post: {
            creator_id: creator.id,
            posted_at: postedAt,
            caption: post.caption ?? "",
          },
        },

        update: {
          post_url: post.postUrl,
          thumbnail_url: post.thumbnailUrl,

          caption: post.caption ?? "",

          likes: safeMetric(post.likes),
          comments: safeMetric(post.comments),
          views: safeMetric(post.views),
          shares: safeMetric(post.shares),
          saves: safeMetric(post.saves),
          reposts: safeMetric(post.reposts),

          is_endorse: isEndorse,
          scraped_at: new Date(),
        },

        create: {
          creator_id: creator.id,

          post_url: post.postUrl,
          thumbnail_url: post.thumbnailUrl,

          caption: post.caption ?? "",

          likes: safeMetric(post.likes),
          comments: safeMetric(post.comments),
          views: safeMetric(post.views),
          shares: safeMetric(post.shares),
          saves: safeMetric(post.saves),
          reposts: safeMetric(post.reposts),

          is_endorse: isEndorse,

          posted_at: postedAt,
          scraped_at: new Date(),
        },
      });

      savedPosts++;
    } catch (error) {
      console.error(
        `  [WARN] gagal simpan post index ${index} (${post.postUrl}):`,
        error
      );
    }
  }

  console.log(
    `  [OK] ${profile.username}: ${savedPosts}/${validPosts.length} post tersimpan`
  );

  /*
   * ============================================================
   * ENRICHMENT
   * ============================================================
   *
   * Quick Search sudah melakukan enrichment sebelum memanggil
   * fungsi ini, sehingga menggunakan skipPostEnrichment: true.
   *
   * Scheduler/pipeline tidak perlu mengirim opsi tersebut,
   * sehingga enrichment tetap dilakukan di sini.
   */

  if (!options.skipPostEnrichment) {
    const latestPosts = await prisma.dtl_creator_posts.findMany({
      where: {
        creator_id: creator.id,
      },
      orderBy: {
        posted_at: "desc",
      },
      take: SHARES_SAVES_ENRICHMENT_LIMIT,
    });

    let enrichedCount = 0;

    for (const post of latestPosts) {
      if (!post.post_url) {
        continue;
      }

      /*
       * Jangan enrichment ulang jika semua field sudah tersedia.
       *
       * Nilai 0 dianggap belum tersedia karena bulk scraper
       * terkadang memberikan 0 untuk metrik yang sebenarnya ada.
       */
      const metricsAreComplete =
        (post.likes ?? 0) > 0 &&
        (post.comments ?? 0) > 0 &&
        (post.views ?? 0) > 0 &&
        (post.shares ?? 0) > 0 &&
        (post.saves ?? 0) > 0 &&
        (post.reposts ?? 0) > 0;

      if (metricsAreComplete) {
        continue;
      }

      try {
        const metrics = await scrapeContentUrl(
          post.post_url,
          profile.socialMedia
        );

        await prisma.dtl_creator_posts.update({
          where: {
            id: post.id,
          },
          data: {
            likes:
              safeMetric(metrics.likes) > 0
                ? safeMetric(metrics.likes)
                : post.likes,

            comments:
              safeMetric(metrics.comments) > 0
                ? safeMetric(metrics.comments)
                : post.comments,

            views:
              safeMetric(metrics.views) > 0
                ? safeMetric(metrics.views)
                : post.views,

            shares:
              safeMetric(metrics.shares) > 0
                ? safeMetric(metrics.shares)
                : post.shares,

            saves:
              safeMetric(metrics.saves) > 0
                ? safeMetric(metrics.saves)
                : post.saves,

            reposts:
              safeMetric(metrics.reposts) > 0
                ? safeMetric(metrics.reposts)
                : post.reposts,

            scraped_at: new Date(),
          },
        });

        enrichedCount++;
      } catch (error) {
        console.error(`  [WARN] gagal enrich ${post.post_url}:`, error);
      }
    }

    console.log(
      `  [OK] ${enrichedCount}/${latestPosts.length} post berhasil di-enrich`
    );
  } else {
    console.log(
      `  [SKIP] enrichment di creator-processor dilewati karena post sudah di-enrich sebelumnya`
    );
  }

  /*
   * ============================================================
   * AMBIL SELURUH POST DARI DATABASE
   * ============================================================
   *
   * Tidak menggunakan "take: 20".
   *
   * Jika terdapat 20 post, perhitungan memakai 20.
   * Jika terdapat 27 post, perhitungan memakai 27.
   * Jika terdapat 50 post, perhitungan memakai 50.
   *
   * Dengan begitu nilai mst_creators akan sama dengan
   * tab Data All di halaman detail.
   */

  const finalStoredPosts = await prisma.dtl_creator_posts.findMany({
    where: {
      creator_id: creator.id,
    },

    orderBy: {
      posted_at: "desc",
    },

    select: {
      caption: true,

      likes: true,
      comments: true,
      views: true,
      shares: true,
      saves: true,
      reposts: true,

      post_url: true,
      thumbnail_url: true,
      posted_at: true,

      is_endorse: true,
    },
  });

  const postsForCalculation = finalStoredPosts.map((post) => ({
    caption: post.caption ?? "",

    likes: safeMetric(post.likes),
    comments: safeMetric(post.comments),
    views: safeMetric(post.views),
    shares: safeMetric(post.shares),
    saves: safeMetric(post.saves),
    reposts: safeMetric(post.reposts),

    postedAt: post.posted_at?.toISOString() ?? "",

    postUrl: post.post_url ?? "",

    thumbnailUrl: post.thumbnail_url ?? undefined,
  }));

  /*
   * ============================================================
   * HITUNG AVG DAN ER DARI SELURUH POST TERSIMPAN
   * ============================================================
   */

  const finalInsights = computeInsightsFromPosts(
    postsForCalculation,
    profile.followers,
    0
  );

  /*
   * Average Brand Views:
   * hanya post endorsement dengan views > 0.
   */

  const finalBrandedViews = finalStoredPosts
    .filter((post) => {
      return post.is_endorse === true && safeMetric(post.views) > 0;
    })
    .map((post) => safeMetric(post.views));

  const finalAverageBrandView =
    finalBrandedViews.length > 0
      ? Math.round(
          finalBrandedViews.reduce((total, views) => total + views, 0) /
            finalBrandedViews.length
        )
      : 0;

  /*
   * ============================================================
   * UPDATE FINAL MST_CREATORS
   * ============================================================
   */

  await prisma.mst_creators.update({
    where: {
      id: creator.id,
    },

    data: {
      average_view: finalInsights.avgViews,
      average_view_brand: finalAverageBrandView,

      avg_likes: finalInsights.avgLikes,
      avg_comments: finalInsights.avgComments,
      avg_shares: finalInsights.avgShares,
      avg_saves: finalInsights.avgSaves,
      avg_reposts: finalInsights.avgReposts,

      er_followers: finalInsights.erFollowers,
      er_views: finalInsights.erViews,
      er_talenthub: finalInsights.erTalenthub,

      top_hashtags:
        finalInsights.topHashtags as unknown as Prisma.InputJsonValue,

      top_mentions:
        finalInsights.topMentions as unknown as Prisma.InputJsonValue,

      last_scraped_at: new Date(),
      updated_at: new Date(),
    },
  });

  console.log(
    `  [OK] AVG/ER ${profile.username} dihitung ulang dari ${finalStoredPosts.length} stored posts`
  );

  /*
   * ============================================================
   * DISCOVER USERNAME BARU
   * ============================================================
   */

  try {
    const newUsernames = await suggestNewUsernames(
      profile.bio ?? "",
      validPosts
    );

    for (const suggestedUsername of newUsernames) {
      const normalizedSuggestedUsername = normalizeUsername(suggestedUsername);

      if (!normalizedSuggestedUsername) {
        continue;
      }

      await prisma.stg_discovered_usernames.upsert({
        where: {
          username_social_media: {
            username: normalizedSuggestedUsername,
            social_media: profile.socialMedia,
          },
        },

        update: {},

        create: {
          username: normalizedSuggestedUsername,
          social_media: profile.socialMedia,
          source_creator_id: creator.id,
        },
      });
    }

    if (newUsernames.length > 0) {
      console.log(`  [+] ${newUsernames.length} username baru masuk staging`);
    }
  } catch (error) {
    /*
     * Kegagalan pencarian username baru tidak boleh membuat
     * proses penyimpanan creator dianggap gagal.
     */
    console.error(
      `  [WARN] gagal mencari username baru dari ${profile.username}:`,
      error
    );
  }

  return creator.id;
}

export async function processCreator(entry: SeedEntry) {
  console.log(`\n--- ${entry.username} (${entry.platform}) ---`);

  /*
   * Scrape profile.
   */

  const profiles =
    entry.platform === "instagram"
      ? await scrapeInstagramProfiles([entry.username])
      : await scrapeTiktokProfiles([entry.username]);

  const profile = profiles[0];

  if (!profile || !profile.isValid) {
    console.log("  [SKIP] username tidak valid/tidak ditemukan");

    return {
      status: "skipped",
      username: entry.username,
    };
  }

  /*
   * Cari kategori.
   */

  const category = await prisma.mst_categories.findFirst({
    where: {
      name: entry.category,
    },
  });

  if (!category) {
    console.log(`  [SKIP] kategori "${entry.category}" tidak ditemukan`);

    return {
      status: "skipped",
      username: entry.username,
    };
  }

  /*
   * Periksa lokasi Indonesia.
   */

  const locationCheck = await checkIndonesianLocation(
    profile.bio ?? "",
    profile.posts
  );

  if (!locationCheck.isIndonesian) {
    console.log(
      `  [SKIP] ${profile.username} kemungkinan bukan akun Indonesia`
    );

    return {
      status: "skipped",
      username: entry.username,
    };
  }

  let cityId: number | undefined;

  if (locationCheck.cityGuess) {
    const city = await prisma.mst_cities.findFirst({
      where: {
        name: {
          contains: locationCheck.cityGuess,
          mode: "insensitive",
        },
      },
    });

    cityId = city?.id;
  }

  /*
   * Scheduler menggunakan enrichment internal.
   * Karena itu skipPostEnrichment tidak perlu dikirim.
   */

  const creatorId = await persistCreatorProfile(profile, {
    categoryId: category.id,
    cityId,
  });

  console.log(
    `  [OK] creator id ${creatorId}, tier ${calculateTier(profile.followers)}`
  );

  return {
    status: "success",
    username: entry.username,
    creatorId,
  };
}

export { prisma };
