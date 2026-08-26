import { NextRequest, NextResponse } from "next/server";
import {
  fetchInstagramBulkPosts,
  scrapeInstagramProfileDetails,
  scrapeTiktokProfiles,
  enrichPosts,
} from "@/lib/apify";
import {
  checkIndonesianLocation,
  classifyAccountCategory,
} from "@/lib/gemini";
import { persistCreatorProfile } from "@/lib/creator-processor";
import { firstProfileImageUrl } from "@/lib/profile-image";
import { prisma } from "@/lib/prisma";

// Beri sedikit headroom dari batas 5 menit Vercel.
export const maxDuration = 280;

// Jumlah post final yang ingin disimpan.
const TARGET_POST_COUNT = 20;

// Kandidat bulk yang disiapkan.
// Bukan berarti 40 post semuanya akan di-enrich.
const CANDIDATE_COUNT = 40;

// Jika dari 20 kandidat pertama ada yang gagal,
// periksa kandidat tambahan secara bertahap.
const REFILL_BATCH_SIZE = 5;

/**
 * Memverifikasi post Instagram secara bertahap.
 *
 * Alurnya:
 * 1. Verifikasi 20 kandidat pertama.
 * 2. Jika belum memperoleh 20 post valid,
 *    periksa kandidat berikutnya maksimal 5 per batch.
 * 3. Berhenti ketika sudah memperoleh 20 post valid
 *    atau kandidat sudah habis.
 */
async function getVerifiedInstagramPosts(
  candidates: Awaited<
    ReturnType<typeof fetchInstagramBulkPosts>
  >
) {
  const verifiedPosts: typeof candidates = [];

  let cursor = 0;
  let firstBatch = true;

  while (
    verifiedPosts.length < TARGET_POST_COUNT &&
    cursor < candidates.length
  ) {
    const remaining =
      TARGET_POST_COUNT - verifiedPosts.length;

    const requestedBatchSize = firstBatch
      ? TARGET_POST_COUNT
      : Math.min(
          REFILL_BATCH_SIZE,
          Math.max(remaining, 1)
        );

    firstBatch = false;

    const batch = candidates.slice(
      cursor,
      cursor + requestedBatchSize
    );

    cursor += batch.length;

    if (batch.length === 0) {
      break;
    }

    const verifiedBatch = await enrichPosts(
      batch,
      "instagram",
      {
        concurrency: 5,

        // Post yang gagal, URL rusak, atau hasil Actor
        // tidak cocok tidak boleh ikut disimpan.
        dropFailed: true,
      }
    );

    verifiedPosts.push(...verifiedBatch);

    console.log(
      `  [QUICK SEARCH] verified=${verifiedPosts.length}/${TARGET_POST_COUNT}, checked=${cursor}/${candidates.length}`
    );
  }

  return verifiedPosts
    .sort(
      (a, b) =>
        new Date(b.postedAt).getTime() -
        new Date(a.postedAt).getTime()
    )
    .slice(0, TARGET_POST_COUNT);
}

export async function POST(
  request: NextRequest
) {
  const body = await request
    .json()
    .catch(() => null);

  const username = String(
    body?.username ?? ""
  )
    .trim()
    .replace(/^@+/, "");

  const socialMedia = String(
    body?.socialMedia ?? ""
  ).toLowerCase();

  if (!username) {
    return NextResponse.json(
      {
        error: "Username wajib diisi",
      },
      {
        status: 400,
      }
    );
  }

  if (
    socialMedia !== "instagram" &&
    socialMedia !== "tiktok"
  ) {
    return NextResponse.json(
      {
        error: "Pilih social media dulu",
      },
      {
        status: 400,
      }
    );
  }

  try {
    // ============================================================
    // STEP 1 — AMBIL PROFIL DAN KANDIDAT POST
    // ============================================================

    let profile;

    if (socialMedia === "instagram") {
      const [details] =
        await scrapeInstagramProfileDetails([
          username,
        ]);

      if (
        !details ||
        !details.isValid
      ) {
        return NextResponse.json({
          inserted: false,
          reason: "not_found",
          message:
            "Akun tidak ditemukan / tidak valid.",
          preview: null,
        });
      }

      // Hanya satu bulk Actor run.
      // Ambil 40 kandidat agar tersedia post pengganti
      // jika beberapa kandidat awal tidak valid.
      const bulkPosts =
        await fetchInstagramBulkPosts(
          username,
          undefined,
          CANDIDATE_COUNT
        );

      if (bulkPosts.length === 0) {
        return NextResponse.json(
          {
            inserted: false,
            reason: "posts_not_found",
            message:
              "Profil ditemukan, tetapi postingannya tidak berhasil diambil.",
            preview: null,
          },
          {
            status: 503,
          }
        );
      }

      profile = {
        ...details,
        posts: bulkPosts,
      };
    } else {
      const [tiktokProfile] =
        await scrapeTiktokProfiles(
          [username],
          undefined,
          TARGET_POST_COUNT,
          {
            // Enrichment dilakukan setelah lolos
            // pemeriksaan lokasi Indonesia.
            enrichPosts: false,
          }
        );

      if (
        !tiktokProfile ||
        !tiktokProfile.isValid
      ) {
        return NextResponse.json({
          inserted: false,
          reason: "not_found",
          message:
            "Akun tidak ditemukan / tidak valid.",
          preview: null,
        });
      }

      profile = tiktokProfile;
    }

    const preview = {
      username: profile.username,
      socialMedia:
        profile.socialMedia,
      followers:
        profile.followers,
      following:
        profile.following,
      totalPost:
        profile.totalPost,

      photoUrl: firstProfileImageUrl([
        ...(profile.photoUrls ?? []),
        profile.photoUrl,
      ]),

      bio: profile.bio ?? "",
    };

    // ============================================================
    // STEP 2 — PEMERIKSAAN LOKASI INDONESIA
    // ============================================================

    const locationCheck =
      await checkIndonesianLocation(
        profile.bio ?? "",
        profile.posts.slice(
          0,
          TARGET_POST_COUNT
        )
      );

    if (!locationCheck.isIndonesian) {
      return NextResponse.json({
        inserted: false,
        reason: "not_indonesia",
        message:
          "Akun terdeteksi bukan dari Indonesia — tidak disimpan ke database.",
        preview,
      });
    }

    // ============================================================
    // STEP 3 — VERIFIKASI DAN ENRICHMENT POST
    // ============================================================

    const [
      enrichedPosts,
      existingCategories,
    ] = await Promise.all([
      socialMedia === "instagram"
        ? getVerifiedInstagramPosts(
            profile.posts
          )
        : enrichPosts(
            profile.posts.slice(
              0,
              TARGET_POST_COUNT
            ),
            "tiktok",
            {
              concurrency: 5,
              dropFailed: true,
            }
          ),

      prisma.mst_categories.findMany({
        select: {
          name: true,
        },
      }),
    ]);

    // Jangan menyimpan creator jika semua post gagal
    // diverifikasi.
    if (enrichedPosts.length === 0) {
      return NextResponse.json(
        {
          inserted: false,
          reason:
            "posts_unverified",

          message:
            "Profil ditemukan, tetapi semua postingannya gagal diverifikasi. Silakan coba lagi beberapa saat lagi.",

          preview,
        },
        {
          status: 503,
        }
      );
    }

    if (
      enrichedPosts.length <
      TARGET_POST_COUNT
    ) {
      console.warn(
        `  [QUICK SEARCH] ${profile.username}: hanya ${enrichedPosts.length}/${TARGET_POST_COUNT} post yang berhasil diverifikasi`
      );
    }

    // ============================================================
    // STEP 4 — KLASIFIKASI KATEGORI
    // ============================================================

    // Gunakan enrichedPosts yang sudah valid.
    // Jangan menggunakan 40 kandidat mentah.
    const categoryName =
      await classifyAccountCategory(
        profile.username,
        profile.bio ?? "",
        enrichedPosts,
        existingCategories.map(
          (category) =>
            category.name
        )
      );

    // ============================================================
    // STEP 5 — CARI KOTA
    // ============================================================

    let cityId:
      | number
      | undefined;

    if (locationCheck.cityGuess) {
      const city =
        await prisma.mst_cities.findFirst({
          where: {
            name: {
              contains:
                locationCheck.cityGuess,

              mode: "insensitive",
            },
          },
        });

      cityId = city?.id;
    }

    // ============================================================
    // STEP 6 — CARI / BUAT KATEGORI
    // ============================================================

    let category =
      await prisma.mst_categories.findFirst({
        where: {
          name: {
            equals: categoryName,
            mode: "insensitive",
          },
        },
      });

    if (
      !category &&
      categoryName
    ) {
      category =
        await prisma.mst_categories.create({
          data: {
            name: categoryName,
          },
        });
    }

    // ============================================================
    // STEP 7 — SIMPAN CREATOR DAN POST YANG SUDAH VALID
    // ============================================================

    const creatorId =
      await persistCreatorProfile(
        {
          ...profile,

          // Hanya post yang berhasil diverifikasi.
          posts: enrichedPosts,
        },
        {
          categoryId:
            category?.id ?? null,

          cityId,

          // Wajib true karena post sudah di-enrich
          // pada Quick Search. Jangan enrich kedua kali.
          skipPostEnrichment: true,
        }
      );

    // ============================================================
    // STEP 8 — RESPONSE
    // ============================================================

    return NextResponse.json({
      inserted: true,
      creatorId,

      verifiedPostCount:
        enrichedPosts.length,

      partial:
        enrichedPosts.length <
        TARGET_POST_COUNT,

      message:
        enrichedPosts.length ===
        TARGET_POST_COUNT
          ? "Creator dan 20 postingan berhasil disimpan."
          : `Creator berhasil disimpan dengan ${enrichedPosts.length} postingan terverifikasi.`,

      preview: {
        ...preview,

        categoryName:
          category?.name ??
          categoryName,
      },
    });
  } catch (error) {
    console.error(
      "Quick search error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unknown error";

    return NextResponse.json(
      {
        inserted: false,

        error:
          "Gagal melakukan scraping, coba lagi.",

        // Berguna untuk log/debug.
        // Kalau tidak ingin ditampilkan di production,
        // hapus field detail ini.
        detail: message,
      },
      {
        status: 500,
      }
    );
  }
}