import { NextRequest, NextResponse } from "next/server";
import { scrapeInstagramProfiles, scrapeTiktokProfiles } from "@/lib/apify";
import { checkIndonesianLocation, classifyAccountCategory } from "@/lib/gemini";
import { persistCreatorProfile } from "@/lib/creator-processor";
import { firstProfileImageUrl } from "@/lib/profile-image";
import { prisma } from "@/lib/prisma";

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
    const profiles =
      socialMedia === "instagram"
        ? await scrapeInstagramProfiles([username])
        : await scrapeTiktokProfiles([username]);

    const profile = profiles[0];

    if (!profile || !profile.isValid) {
      return NextResponse.json({
        inserted: false,
        reason: "not_found",
        message: "Akun tidak ditemukan / tidak valid.",
        preview: null,
      });
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

    // Ketentuan #1: harus lolos cek lokasi Indonesia
    const locationCheck = await checkIndonesianLocation(profile.bio ?? "", profile.posts);

    if (!locationCheck.isIndonesian) {
      return NextResponse.json({
        inserted: false,
        reason: "not_indonesia",
        message: "Akun terdeteksi bukan dari Indonesia — tidak disimpan ke database.",
        preview,
      });
    }

    let cityId: number | undefined;
    if (locationCheck.cityGuess) {
      const city = await prisma.mst_cities.findFirst({
        where: { name: { contains: locationCheck.cityGuess, mode: "insensitive" } },
      });
      cityId = city?.id;
    }

    // Aman (lolos cek Indonesia) -> klasifikasi kategori pakai Gemini sebelum insert
    const existingCategories = await prisma.mst_categories.findMany({
      select: { name: true },
    });
    const categoryName = await classifyAccountCategory(
      profile.username,
      profile.bio ?? "",
      profile.posts,
      existingCategories.map((c) => c.name)
    );

    // classifyAccountCategory boleh balikin nama kategori BARU (belum ada di DB),
    // jadi cari dulu case-insensitive, kalau gak ketemu baru bikin baru.
    let category = await prisma.mst_categories.findFirst({
      where: { name: { equals: categoryName, mode: "insensitive" } },
    });
    if (!category && categoryName) {
      category = await prisma.mst_categories.create({
        data: { name: categoryName },
      });
    }

    const creatorId = await persistCreatorProfile(profile, {
      categoryId: category?.id ?? null,
      cityId,
    });

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