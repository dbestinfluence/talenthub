import { NextRequest, NextResponse } from "next/server";
import {
  enrichPosts,
  fetchInstagramBulkPosts,
  scrapeInstagramProfileDetails,
  scrapeTiktokProfiles,
  type RawPost,
  type RawProfile,
} from "@/lib/apify";
import { checkIndonesianLocation, classifyAccountCategory } from "@/lib/gemini";
import { persistCreatorProfile } from "@/lib/creator-processor";
import { firstProfileImageUrl } from "@/lib/profile-image";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

const QUICK_SEARCH_POST_LIMIT = 20;
const QUICK_SEARCH_ENRICH_LIMIT = 10;
const ENRICHMENT_CONCURRENCY = 1;

function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

function selectLatestPosts(
  posts: RawPost[],
  expectedUsername: string
): RawPost[] {
  const normalizedExpected = normalizeUsername(expectedUsername);
  const seenUrls = new Set<string>();

  return posts
    .filter((post) => {
      const owner = normalizeUsername(post.ownerUsername ?? "");

      if (!post.postUrl || !post.postedAt) return false;
      if (owner && owner !== normalizedExpected) {
        console.warn(
          `  [QUICK SEARCH] owner berbeda dibuang: ${owner} !== ${normalizedExpected}`
        );
        return false;
      }
      if (Number.isNaN(new Date(post.postedAt).getTime())) return false;
      if (seenUrls.has(post.postUrl)) return false;

      seenUrls.add(post.postUrl);
      return true;
    })
    .sort(
      (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
    )
    .slice(0, QUICK_SEARCH_POST_LIMIT);
}

function initialPostScore(post: RawPost): number {
  const likes = Number(post.likes ?? 0);
  const comments = Number(post.comments ?? 0);
  const views = Number(post.views ?? 0);

  /*
   * shares, saves, dan reposts belum tentu
   * tersedia sebelum enrichPosts dijalankan.
   *
   * Views diberi bobot 1% supaya post dengan
   * views besar tidak selalu mengalahkan post
   * dengan engagement tinggi.
   */
  return likes + comments + views * 0.01;
}

function selectBestPosts(posts: RawPost[], limit: number): RawPost[] {
  return [...posts]
    .sort((a, b) => {
      const scoreDifference = initialPostScore(b) - initialPostScore(a);

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
    })
    .slice(0, limit);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const username = normalizeUsername(String(body?.username ?? ""));
  const socialMedia = String(body?.socialMedia ?? "")
    .trim()
    .toLowerCase();

  if (!username) {
    return NextResponse.json(
      { error: "Username wajib diisi" },
      { status: 400 }
    );
  }

  if (socialMedia !== "instagram" && socialMedia !== "tiktok") {
    return NextResponse.json(
      { error: "Pilih social media terlebih dahulu" },
      { status: 400 }
    );
  }

  try {
    let profile: RawProfile;

    if (socialMedia === "instagram") {
      const [details] = await scrapeInstagramProfileDetails([username]);

      if (!details || !details.isValid) {
        return NextResponse.json({
          inserted: false,
          reason: "not_found",
          message: "Akun Instagram tidak ditemukan atau tidak valid.",
          preview: null,
        });
      }

      const bulkPosts = await fetchInstagramBulkPosts(
        details.username,
        undefined,
        QUICK_SEARCH_POST_LIMIT
      );

      profile = {
        ...details,
        posts: selectLatestPosts(bulkPosts, details.username),
      };
    } else {
      const [tiktokProfile] = await scrapeTiktokProfiles(
        [username],
        undefined,
        QUICK_SEARCH_POST_LIMIT,
        { enrichPosts: false }
      );

      if (!tiktokProfile || !tiktokProfile.isValid) {
        return NextResponse.json({
          inserted: false,
          reason: "not_found",
          message: "Akun TikTok tidak ditemukan atau tidak valid.",
          preview: null,
        });
      }

      profile = {
        ...tiktokProfile,
        posts: selectLatestPosts(tiktokProfile.posts, tiktokProfile.username),
      };
    }

    const preview = {
      username: profile.username,
      socialMedia: profile.socialMedia,
      followers: profile.followers,
      following: profile.following,
      totalPost: profile.totalPost,
      photoUrl: firstProfileImageUrl([
        ...(profile.photoUrls ?? []),
        profile.photoUrl,
      ]),
      bio: profile.bio ?? "",
      benchmarkPostCount: profile.posts.length,
    };

    if (profile.posts.length === 0) {
      return NextResponse.json(
        {
          inserted: false,
          reason: "no_posts",
          message: "Tidak ada postingan valid yang berhasil diperoleh.",
          preview,
        },
        { status: 422 }
      );
    }

    const locationCheck = await checkIndonesianLocation(
      profile.bio ?? "",
      profile.posts
    );

    if (!locationCheck.isIndonesian) {
      return NextResponse.json({
        inserted: false,
        reason: "not_indonesia",
        message: "Akun terdeteksi bukan dari Indonesia — tidak disimpan.",
        preview,
      });
    }

    const selectedPosts = selectBestPosts(
      profile.posts,
      QUICK_SEARCH_ENRICH_LIMIT
    );

    console.log(
      `[QUICK SEARCH] ${profile.posts.length} postingan ditemukan; ` +
        `${selectedPosts.length} postingan terbaik akan diproses detail.`
    );

    const [enrichedPosts, existingCategories] = await Promise.all([
      enrichPosts(selectedPosts, socialMedia as "instagram" | "tiktok", {
        concurrency: ENRICHMENT_CONCURRENCY,
        dropFailed: false,
        expectedUsername: profile.username,
      }),

      prisma.mst_categories.findMany({
        select: {
          name: true,
        },
      }),
    ]);

    if (enrichedPosts.length === 0) {
      return NextResponse.json(
        {
          inserted: false,
          reason: "no_posts",
          message: "Postingan tidak berhasil diproses. Data lama tidak diubah.",
          preview,
        },
        { status: 422 }
      );
    }

    const categoryName = await classifyAccountCategory(
      profile.username,
      profile.bio ?? "",
      enrichedPosts,
      existingCategories.map((category) => category.name)
    );

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

    let category = await prisma.mst_categories.findFirst({
      where: {
        name: {
          equals: categoryName,
          mode: "insensitive",
        },
      },
    });

    if (!category && categoryName) {
      category = await prisma.mst_categories.create({
        data: { name: categoryName },
      });
    }

    const creatorId = await persistCreatorProfile(
      { ...profile, posts: enrichedPosts },
      {
        categoryId: category?.id ?? null,
        cityId,
        skipPostEnrichment: true,
        replaceStoredPosts: true,
      }
    );

    return NextResponse.json({
      inserted: true,
      creatorId,
      postCount: enrichedPosts.length,
      message: `${enrichedPosts.length} postingan berhasil diproses dan disimpan.`,
      preview: {
        ...preview,
        benchmarkPostCount: enrichedPosts.length,
        categoryName: category?.name ?? categoryName,
      },
    });
  } catch (error) {
    console.error("Quick search error:", error);
    const detail = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        inserted: false,
        error: "Gagal melakukan scraping, coba lagi.",
        detail: process.env.NODE_ENV === "development" ? detail : undefined,
      },
      { status: 500 }
    );
  }
}
