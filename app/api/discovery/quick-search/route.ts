import { NextRequest, NextResponse } from "next/server";
import {
  fetchInstagramBulkPosts,
  scrapeInstagramProfileDetails,
  scrapeTiktokProfiles,
  enrichPosts,
} from "@/lib/apify";
import { checkIndonesianLocation, classifyAccountCategory } from "@/lib/gemini";
import { persistCreatorProfile } from "@/lib/creator-processor";
import { firstProfileImageUrl } from "@/lib/profile-image";
import { prisma } from "@/lib/prisma";

// kasih headroom di bawah limit 5 menit vercel
export const maxDuration = 280;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const username = String(body?.username ?? "").trim().replace(/^@+/, "");
  const socialMedia = String(body?.socialMedia ?? "").toLowerCase();

  if (!username) {
    return NextResponse.json({ error: "Username wajib diisi" }, { status: 400 });
  }
  if (socialMedia !== "instagram" && socialMedia !== "tiktok") {
    return NextResponse.json({ error: "Pilih social media dulu" }, { status: 400 });
  }

  try {
    // ============================================================
    // STEP 1 — BULK FETCH SAJA (murah, tanpa enrich per-post)
    // ============================================================
    let profile;
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
      const bulkPosts = await fetchInstagramBulkPosts(username);
      profile = { ...details, posts: bulkPosts };
    } else {
      const [tiktokProfile] = await scrapeTiktokProfiles([username], undefined, 20, {
        enrichPosts: false,
      });
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
      photoUrl: firstProfileImageUrl([...(profile.photoUrls ?? []), profile.photoUrl]),
      bio: profile.bio ?? "",
    };

    // ============================================================
    // STEP 2 — GATE: cek Indonesia SEBELUM enrich (hemat waktu besar
    // untuk akun yang bakal ditolak)
    // ============================================================
    const locationCheck = await checkIndonesianLocation(profile.bio ?? "", profile.posts);

    if (!locationCheck.isIndonesian) {
      return NextResponse.json({
        inserted: false,
        reason: "not_indonesia",
        message: "Akun terdeteksi bukan dari Indonesia — tidak disimpan ke database.",
        preview,
      });
    }

    // ============================================================
    // STEP 3 — Lolos gate: baru enrich post (paralel) SEKALIGUS
    // classify category (jalan bareng, tidak saling nunggu)
    // ============================================================
    const [enrichedPosts, existingCategories] = await Promise.all([
      enrichPosts(profile.posts, socialMedia as "instagram" | "tiktok", {
        concurrency: 5,
      }),
      prisma.mst_categories.findMany({ select: { name: true } }),
    ]);

    const categoryName = await classifyAccountCategory(
      profile.username,
      profile.bio ?? "",
      profile.posts, // caption mentah cukup, gak perlu tunggu enrichedPosts
      existingCategories.map((c) => c.name)
    );

    let cityId: number | undefined;
    if (locationCheck.cityGuess) {
      const city = await prisma.mst_cities.findFirst({
        where: { name: { contains: locationCheck.cityGuess, mode: "insensitive" } },
      });
      cityId = city?.id;
    }

    let category = await prisma.mst_categories.findFirst({
      where: { name: { equals: categoryName, mode: "insensitive" } },
    });
    if (!category && categoryName) {
      category = await prisma.mst_categories.create({ data: { name: categoryName } });
    }

    const creatorId = await persistCreatorProfile(
      { ...profile, posts: enrichedPosts },
      { categoryId: category?.id ?? null, cityId }
    );

    return NextResponse.json({
      inserted: true,
      creatorId,
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