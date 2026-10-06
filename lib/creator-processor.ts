import { PrismaClient, Prisma } from "@prisma/client";

import {

  scrapeInstagramProfiles,

  scrapeTiktokProfiles,

  scrapeContentUrl,

  RawPost,

  RawProfile,

} from "./apify";

import {

  detectEndorsePosts,

  suggestNewUsernames,

  checkIndonesianLocation,

} from "./gemini";

import { computeInsightsFromPosts } from "./insights";

import {

  downloadImageWithRetry,

  type DownloadedImage,

} from "./database-image";



const prisma = new PrismaClient();



export interface SeedEntry {

  username: string;

  platform: "instagram" | "tiktok";

  category: string;

}



// Berapa post TERBARU (dari DB) yang di-enrich shares/saves/reposts-nya tiap

// kali profil ini di-persist. scrapeContentUrl (actor detail per-URL) sudah

// terbukti akurat untuk ketiga metrik ini — bulk scraper (scrapeInstagramProfiles/

// scrapeTiktokProfiles) TIDAK reliable untuk field ini sama sekali (Instagram)

// atau cuma sebagian (TikTok: shares/saves ada, reposts nggak).

//

// Dinaikkan ke 30 supaya SEMUA post yang di-scrape (resultsLimit default di

// scrapeInstagramProfiles/scrapeTiktokProfiles juga 30) ikut ter-enrich, bukan

// cuma 5 terbaru. Post yang sudah pernah di-enrich (shares/saves/reposts sudah

// terisi) otomatis di-skip di run berikutnya, jadi menaikkan angka ini TIDAK

// menambah biaya scraping untuk post yang sudah pernah diproses sebelumnya —

// hanya menambah biaya untuk post baru/belum ter-enrich.

const SHARES_SAVES_ENRICHMENT_LIMIT = 20;

const TOP_CONTENT_LIMIT = 5;

function contentScore(post: RawPost): number {

  return (

    Number(post.views ?? 0) +

    Number(post.likes ?? 0) +

    Number(post.comments ?? 0) +

    Number(post.shares ?? 0) +

    Number(post.saves ?? 0) +

    Number(post.reposts ?? 0)

  );

}

function selectTopContent(posts: RawPost[]): RawPost[] {

  return [...posts]

    .filter((post) => Boolean(post.postUrl) && Boolean(post.thumbnailUrl))

    .sort((a, b) => {

      const scoreDifference = contentScore(b) - contentScore(a);

      if (scoreDifference !== 0) return scoreDifference;

      return (

        new Date(b.postedAt).getTime() -

        new Date(a.postedAt).getTime()

      );

    })

    .slice(0, TOP_CONTENT_LIMIT);

}



function average(nums: number[]): number {

  if (nums.length === 0) return 0;

  return nums.reduce((a, b) => a + b, 0) / nums.length;

}



function calculateTier(followers: number): string {

  if (followers >= 1_000_000) return "Mega";

  if (followers >= 100_000) return "Macro";

  if (followers >= 10_000) return "Micro";

  return "Nano";

}



export interface PersistOptions {

  categoryId?: number | null;

  cityId?: number | null;

  skipPostEnrichment?: boolean;

  replaceStoredPosts?: boolean;

}



// Dipakai baik oleh processCreator (seed script) maupun quick-search API,

// supaya keduanya konsisten pakai logic yang sama persis — termasuk fix

// reposts dan enrichment di bawah ini.

export async function persistCreatorProfile(

  profile: RawProfile,

  options: PersistOptions = {}

): Promise<number> {

  const endorseResults = await detectEndorsePosts(

    profile.username,

    profile.posts

  );



  const allViews = profile.posts

    .map((p: RawPost) => p.views ?? 0)

    .filter((v: number) => v > 0);

  const avgView = average(allViews);



  const brandedViews = profile.posts

    .filter(

      (_: RawPost, i: number) =>

        endorseResults.find((e) => e.index === i)?.isEndorse

    )

    .map((p: RawPost) => p.views ?? 0)

    .filter((v: number) => v > 0);

  const avgViewBrand = average(brandedViews);



  const tier = calculateTier(profile.followers);



  const existingCreator = await prisma.mst_creators.findUnique({

    where: {

      username_social_media: {

        username: profile.username,

        social_media: profile.socialMedia,

      },

    },

    select: {

      photo_data: true,

    },

  });



  const downloadedProfilePhoto = await downloadImageWithRetry(

    [...(profile.photoUrls ?? []), profile.photoUrl],

    {

      platform: profile.socialMedia,

      kind: "profile",

      label: `foto profil ${profile.username}`,

      attempts: 3,

    }

  );



  const validPosts = profile.posts.filter(

    (post) => post.likes >= 0 && post.comments >= 0 && Boolean(post.postUrl)

  );



  // insights.erFollowers / erViews / erTalenthub sudah menggantikan

  // engagement_rate lama (yang cuma likes+comments, tanpa shares/saves).

  // engagement_rate DIHAPUS dari sini dan dari schema penggunaannya —

  // sekarang satu-satunya sumber ER adalah insights ini.

  const insights = computeInsightsFromPosts(

    validPosts,

    profile.followers,

    profile.totalPost

  );



  const creator = await prisma.mst_creators.upsert({

    where: {

      username_social_media: {

        username: profile.username,

        social_media: profile.socialMedia,

      },

    },

    update: {

      followers: profile.followers,

      following: profile.following,

      total_post: profile.totalPost,

      photo_url: null,

      ...(downloadedProfilePhoto

        ? {

            photo_data: downloadedProfilePhoto.data,

            photo_mime_type: downloadedProfilePhoto.mimeType,

            photo_updated_at: new Date(),

          }

        : {}),

      tier,

      average_view: Math.round(avgView),

      average_view_brand: Math.round(avgViewBrand),

      avg_likes: insights.avgLikes,

      avg_comments: insights.avgComments,

      avg_shares: insights.avgShares,

      avg_saves: insights.avgSaves,

      avg_reposts: insights.avgReposts,

      er_followers: insights.erFollowers,

      er_views: insights.erViews,

      er_talenthub: insights.erTalenthub,

      top_hashtags: insights.topHashtags as unknown as Prisma.InputJsonValue,

      top_mentions: insights.topMentions as unknown as Prisma.InputJsonValue,

      ...(options.categoryId != null

        ? { category_id: options.categoryId }

        : {}),

      ...(options.cityId != null ? { city_id: options.cityId } : {}),

      updated_at: new Date(),

    } satisfies Prisma.mst_creatorsUncheckedUpdateInput,

    create: {

      username: profile.username,

      name: profile.username,

      followers: profile.followers,

      following: profile.following,

      total_post: profile.totalPost,

      photo_url: null,

      photo_data: downloadedProfilePhoto?.data ?? null,

      photo_mime_type: downloadedProfilePhoto?.mimeType ?? null,

      photo_updated_at: downloadedProfilePhoto ? new Date() : null,

      social_media: profile.socialMedia,

      tier,

      gender: "unknown",

      category_id: options.categoryId ?? null,

      city_id: options.cityId ?? null,

      average_view: Math.round(avgView),

      average_view_brand: Math.round(avgViewBrand),

      avg_likes: insights.avgLikes,

      avg_comments: insights.avgComments,

      avg_shares: insights.avgShares,

      avg_saves: insights.avgSaves,

      avg_reposts: insights.avgReposts,

      er_followers: insights.erFollowers,

      er_views: insights.erViews,

      er_talenthub: insights.erTalenthub,

      top_hashtags: insights.topHashtags as unknown as Prisma.InputJsonValue,

      top_mentions: insights.topMentions as unknown as Prisma.InputJsonValue,

    } satisfies Prisma.mst_creatorsUncheckedCreateInput,

  });



  const hasProfilePhoto =

    Boolean(downloadedProfilePhoto) || Boolean(existingCreator?.photo_data);



  await prisma.mst_creators.update({

    where: { id: creator.id },

    data: {

      photo_url: hasProfilePhoto

        ? `/api/media/creators/${creator.id}`

        : null,

    },

  });



  const existingPosts = await prisma.dtl_creator_posts.findMany({

    where: { creator_id: creator.id },

    select: {

      post_url: true,

      thumbnail_data: true,

      thumbnail_mime_type: true,

    },

  });



  const oldThumbnailByPostUrl = new Map<string, DownloadedImage>();



  for (const post of existingPosts) {

    const postUrl = String(post.post_url ?? "").trim();

    if (!postUrl || !post.thumbnail_data) continue;

    const data = new Uint8Array(post.thumbnail_data.byteLength);

    data.set(post.thumbnail_data);

    oldThumbnailByPostUrl.set(postUrl, {

      data,

      mimeType: post.thumbnail_mime_type ?? "application/octet-stream",

      sizeBytes: data.byteLength,

    });

  }



  const topContent = selectTopContent(profile.posts);

  const topPostUrls = new Set(topContent.map((post) => post.postUrl));

  const thumbnailByPostUrl = new Map<string, DownloadedImage>();



  // Download sequential agar tidak membanjiri CDN dan aman untuk VPS kecil.

  for (const post of topContent) {

    const downloaded = await downloadImageWithRetry(

      [post.thumbnailUrl],

      {

        platform: profile.socialMedia,

        kind: "thumbnail",

        label: `thumbnail ${post.postUrl}`,

        attempts: 3,

      }

    );



    const image = downloaded ?? oldThumbnailByPostUrl.get(post.postUrl);

    if (image) thumbnailByPostUrl.set(post.postUrl, image);

  }



  console.log(

    `  [MEDIA] ${thumbnailByPostUrl.size}/${topContent.length} thumbnail Top 5 siap disimpan`

  );



  const transactionResult = await prisma.$transaction(

    async (tx) => {

      const savedIds: number[] = [];



      for (let i = 0; i < profile.posts.length; i++) {

        const p = profile.posts[i];

        const isTopContent = topPostUrls.has(p.postUrl);

        const thumbnail = isTopContent

          ? thumbnailByPostUrl.get(p.postUrl)

          : undefined;



        const storedPost = await tx.dtl_creator_posts.upsert({

          where: {

            uq_creator_post: {

              creator_id: creator.id,

              posted_at: new Date(p.postedAt),

              caption: p.caption,

            },

          },

          update: {

            likes: p.likes,

            comments: p.comments,

            views: p.views,

            shares: p.shares,

            saves: p.saves,

            reposts: p.reposts,

            post_url: p.postUrl,

            thumbnail_url: null,

            thumbnail_data: thumbnail?.data ?? null,

            thumbnail_mime_type: thumbnail?.mimeType ?? null,

            thumbnail_updated_at: thumbnail ? new Date() : null,

            is_top_content: isTopContent,

            is_endorse:

              endorseResults.find((e) => e.index === i)?.isEndorse ?? false,

          } satisfies Prisma.dtl_creator_postsUncheckedUpdateInput,

          create: {

            creator_id: creator.id,

            caption: p.caption,

            likes: p.likes,

            comments: p.comments,

            views: p.views,

            shares: p.shares,

            saves: p.saves,

            reposts: p.reposts,

            post_url: p.postUrl,

            thumbnail_url: null,

            thumbnail_data: thumbnail?.data ?? null,

            thumbnail_mime_type: thumbnail?.mimeType ?? null,

            thumbnail_updated_at: thumbnail ? new Date() : null,

            is_top_content: isTopContent,

            is_endorse:

              endorseResults.find((e) => e.index === i)?.isEndorse ?? false,

            posted_at: new Date(p.postedAt),

          } satisfies Prisma.dtl_creator_postsUncheckedCreateInput,

        });



        savedIds.push(storedPost.id);

      }



      let deletedCount = 0;

      if (options.replaceStoredPosts === true) {

        const deleted = await tx.dtl_creator_posts.deleteMany({

          where: {

            creator_id: creator.id,

            id: { notIn: savedIds },

          },

        });

        deletedCount = deleted.count;

      }



      return {

        savedPosts: savedIds.length,

        deletedPosts: deletedCount,

      };

    },

    {

      maxWait: 10_000,

      timeout: 60_000,

    }

  );



  const savedPosts = transactionResult.savedPosts;



  if (options.replaceStoredPosts === true) {

    console.log(

      `  [CLEANUP] ${transactionResult.deletedPosts} post lama ${profile.username} dihapus setelah data baru aman`

    );

  }

  console.log(

    `  [OK] persistCreatorProfile: ${profile.username}, id ${creator.id}, ${savedPosts}/${profile.posts.length} post`

  );



  // Enrichment shares/saves/reposts untuk N post TERBARU creator ini (dari DB).

  // Bulk scraper TIDAK reliable untuk metrik ini — scrapeContentUrl (actor

  // detail per-URL) sudah terbukti akurat untuk ketiganya (lihat ContentMetrics),

  // jadi dipakai di sini untuk memperkaya data yang sudah di-upsert di atas.

  const latestPosts = options.skipPostEnrichment

    ? []

    : await prisma.dtl_creator_posts.findMany({

        where: { creator_id: creator.id },

        orderBy: { posted_at: "desc" },

        take: SHARES_SAVES_ENRICHMENT_LIMIT,

      });



  if (options.skipPostEnrichment) {

    console.log(

      "  [SKIP] enrichment di creator-processor dilewati karena post sudah diproses"

    );

  }



  let enrichedCount = 0;

  for (const post of latestPosts) {

    // FIX: dulu cuma cek shares & saves, sehingga untuk TikTok (yang

    // shares/saves sudah terisi dari bulk scraper) baris ini selalu ke-skip

    // dan reposts-nya tidak pernah ter-enrich. Sekarang ketiga field dicek.



    if (

      (post.likes ?? 0) > 0 &&

      (post.comments ?? 0) > 0 &&

      (post.views ?? 0) > 0 &&

      (post.shares ?? 0) > 0 &&

      (post.saves ?? 0) > 0 &&

      (post.reposts ?? 0) > 0

    ) {

      continue;

    }



    if (!post.post_url) continue;

    try {

      const metrics = await scrapeContentUrl(

        post.post_url,

        profile.socialMedia,

        profile.username

      );

      await prisma.dtl_creator_posts.update({

        where: { id: post.id },

        data: {

          likes: metrics.likes > 0 ? metrics.likes : post.likes,



          comments: metrics.comments > 0 ? metrics.comments : post.comments,



          views: metrics.views > 0 ? metrics.views : post.views,



          shares: metrics.shares > 0 ? metrics.shares : post.shares,



          saves: metrics.saves > 0 ? metrics.saves : post.saves,



          reposts: metrics.reposts > 0 ? metrics.reposts : post.reposts,

        },

      });

      enrichedCount++;

    } catch (err) {

      // Shares/saves/reposts cuma metrik pelengkap — gagal di satu post nggak

      // boleh menggagalkan seluruh persistCreatorProfile.

      console.error(

        `  [WARN] gagal enrich shares/saves/reposts untuk ${post.post_url}:`,

        err

      );

    }

  }

  console.log(

    `  [OK] ${enrichedCount}/${latestPosts.length} post berhasil di-enrich shares/saves/reposts`

  );



  // ============================================================

  // HITUNG ULANG AVG DAN ER SETELAH SEMUA POST SELESAI DI-ENRICH

  // ============================================================



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

    likes: post.likes ?? 0,

    comments: post.comments ?? 0,

    views: post.views ?? 0,

    shares: post.shares ?? 0,

    saves: post.saves ?? 0,

    reposts: post.reposts ?? 0,

    postedAt: post.posted_at?.toISOString() ?? "",

    postUrl: post.post_url ?? "",

    thumbnailUrl: post.thumbnail_url ?? undefined,

  }));



  const finalInsights = computeInsightsFromPosts(

    postsForCalculation,

    profile.followers,

    0

  );



  // Average Brand Views:

  // hanya postingan endorse yang memiliki views > 0

  const finalBrandedViews = finalStoredPosts

    .filter((post) => post.is_endorse === true && (post.views ?? 0) > 0)

    .map((post) => post.views ?? 0);



  const finalAverageBrandView =

    finalBrandedViews.length > 0

      ? Math.round(

          finalBrandedViews.reduce((total, views) => total + views, 0) /

            finalBrandedViews.length

        )

      : 0;



  // Overwrite AVG dan ER di mst_creators menggunakan data post final

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

    `  [OK] AVG dan ER ${profile.username} dihitung ulang dari ${finalStoredPosts.length} stored posts`

  );



  const newUsernames = await suggestNewUsernames(

    profile.bio ?? "",

    profile.posts

  );

  for (const username of newUsernames) {

    await prisma.stg_discovered_usernames.upsert({

      where: {

        username_social_media: { username, social_media: profile.socialMedia },

      },

      update: {},

      create: {

        username,

        social_media: profile.socialMedia,

        source_creator_id: creator.id,

      },

    });

  }

  if (newUsernames.length > 0) {

    console.log(

      `  [+] ${newUsernames.length} username baru ditemukan, masuk staging`

    );

  }



  return creator.id;

}



export async function processCreator(entry: SeedEntry) {

  console.log(`\n--- ${entry.username} (${entry.platform}) ---`);



  // 1. Scrape

  const profiles =

    entry.platform === "instagram"

      ? await scrapeInstagramProfiles([entry.username])

      : await scrapeTiktokProfiles([entry.username]);



  const profile = profiles[0];

  if (!profile || !profile.isValid) {

    console.log("  [SKIP] username tidak valid/tidak ditemukan");

    return { status: "skipped", username: entry.username };

  }



  // 2. Cek kategori ada di database

  const category = await prisma.mst_categories.findFirst({

    where: { name: entry.category },

  });

  if (!category) {

    console.log(

      `  [SKIP] kategori "${entry.category}" tidak ada di mst_categories`

    );

    return { status: "skipped", username: entry.username };

  }



  // 3. Cek lokasi Indonesia

  const locationCheck = await checkIndonesianLocation(

    profile.bio ?? "",

    profile.posts

  );

  if (!locationCheck.isIndonesian) {

    console.log(

      `  [SKIP] ${profile.username} — kemungkinan bukan akun Indonesia`

    );

    return { status: "skipped", username: entry.username };

  }



  let cityId: number | undefined;

  if (locationCheck.cityGuess) {

    const city = await prisma.mst_cities.findFirst({

      where: {

        name: { contains: locationCheck.cityGuess, mode: "insensitive" },

      },

    });

    cityId = city?.id;

  }



  // 4-7. Hitung metrics, simpan creator + posts, enrichment, cari username baru

  const creatorId = await persistCreatorProfile(profile, {

    categoryId: category.id,

    cityId,

  });

  console.log(

    `  [OK] creator id ${creatorId}, tier ${calculateTier(profile.followers)}`

  );



  return { status: "success", username: entry.username, creatorId };

}



export { prisma };
