import { NextRequest, NextResponse } from "next/server";
import {
  fetchInstagramBulkPosts,
  scrapeInstagramProfileDetails,
  scrapeTiktokProfiles,
  enrichPosts,
  type RawPost,
  type RawProfile,
} from "@/lib/apify";
import { checkIndonesianLocation, classifyAccountCategory } from "@/lib/gemini";
import { persistCreatorProfile } from "@/lib/creator-processor";
import { firstProfileImageUrl } from "@/lib/profile-image";
import { prisma } from "@/lib/prisma";

export const maxDuration = 280;

const TARGET_POST_COUNT = 20;
const CANDIDATE_COUNT = 40;
const REFILL_BATCH_SIZE = 5;

async function getVerifiedInstagramPosts(
  candidates: RawPost[],
  expectedUsername: string
): Promise<RawPost[]> {
  const verifiedPosts: RawPost[] = [];
  let cursor = 0;
  let firstBatch = true;

  while (
    verifiedPosts.length < TARGET_POST_COUNT &&
    cursor < candidates.length
  ) {
    const remaining = TARGET_POST_COUNT - verifiedPosts.length;
    const batchSize = firstBatch
      ? TARGET_POST_COUNT
      : Math.min(REFILL_BATCH_SIZE, remaining);

    firstBatch = false;
    const batch = candidates.slice(cursor, cursor + batchSize);
    cursor += batch.length;
    if (batch.length === 0) break;

    const verifiedBatch = await enrichPosts(batch, "instagram", {
      concurrency: 5,
      dropFailed: true,
      expectedUsername,
    });

    verifiedPosts.push(...verifiedBatch);

    console.log(
      `  [QUICK SEARCH] verified=${verifiedPosts.length}/${TARGET_POST_COUNT}, checked=${cursor}/${candidates.length}`
    );
  }

  return verifiedPosts
    .sort(
      (a, b) =>
        new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
    )
    .slice(0, TARGET_POST_COUNT);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const username = String(body?.username ?? "").trim().replace(/^@+/, "");
  const socialMedia = String(body?.socialMedia ?? "").toLowerCase();

  if (!username) {
    return NextResponse.json({ error: "Username wajib diisi" }, { status: 400 });
  }

  if (socialMedia !== "instagram" && socialMedia !== "tiktok") {
    return NextResponse.json(
      { error: "Pilih social media dulu" },
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
          message: "Akun tidak ditemukan / tidak valid.",
          preview: null,
        });
      }

      const bulkPosts = await fetchInstagramBulkPosts(
        details.username,
        undefined,
        CANDIDATE_COUNT
      );

      profile = { ...details, posts: bulkPosts };
    } else {
      const [tiktokProfile] = await scrapeTiktokProfiles(
        [username],
        undefined,
        TARGET_POST_COUNT,
        { enrichPosts: false }
      );

      if (!tiktokProfile || !tiktokProfile.isValid) {
        return NextResponse.json({
          inserted: false,
          reason: "not_found",
          message: "Akun tidak ditemukan / tidak valid.",
          preview: null,
        });
      }

      profile = tiktokProfile;
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
    };

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

    const [verifiedPosts, existingCategories] = await Promise.all([
      socialMedia === "instagram"
        ? getVerifiedInstagramPosts(profile.posts, profile.username)
        : enrichPosts(profile.posts.slice(0, TARGET_POST_COUNT), "tiktok", {
            concurrency: 5,
            dropFailed: true,
            expectedUsername: profile.username,
          }),
      prisma.mst_categories.findMany({ select: { name: true } }),
    ]);

    if (verifiedPosts.length === 0) {
      return NextResponse.json(
        {
          inserted: false,
          reason: "no_verified_posts",
          message:
            "Tidak ada post yang lolos verifikasi URL dan pemilik. Data lama tidak diubah.",
          preview,
        },
        { status: 422 }
      );
    }

    const categoryName = await classifyAccountCategory(
      profile.username,
      profile.bio ?? "",
      verifiedPosts,
      existingCategories.map((category) => category.name)
    );

    let cityId: number | undefined;
    if (locationCheck.cityGuess) {
      const city = await prisma.mst_cities.findFirst({
        where: {
          name: { contains: locationCheck.cityGuess, mode: "insensitive" },
        },
      });
      cityId = city?.id;
    }

    let category = await prisma.mst_categories.findFirst({
      where: { name: { equals: categoryName, mode: "insensitive" } },
    });

    if (!category && categoryName) {
      category = await prisma.mst_categories.create({
        data: { name: categoryName },
      });
    }

    const creatorId = await persistCreatorProfile(
      { ...profile, posts: verifiedPosts },
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
      verifiedPostCount: verifiedPosts.length,
      preview: { ...preview, categoryName: category?.name ?? categoryName },
    });
  } catch (error) {
    console.error("Quick search error:", error);
    return NextResponse.json(
      { error: "Gagal melakukan scraping, coba lagi." },
      { status: 500 }
    );
  }
}
