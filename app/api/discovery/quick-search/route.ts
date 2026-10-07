import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  enrichPosts,
  fetchInstagramBulkPosts,
  scrapeInstagramProfileDetails,
  scrapeTiktokProfiles,
  type RawPost,
  type RawProfile,
} from "@/lib/apify";

import {
  checkIndonesianLocation,
  classifyAccountCategory,
} from "@/lib/gemini";

import {
  persistCreatorProfile,
} from "@/lib/creator-processor";

import {
  firstProfileImageUrl,
} from "@/lib/profile-image";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/*
 * Ambil maksimal 20 post dari bulk scraper.
 * Setelah itu pilih 10 post terbaik untuk
 * diproses menggunakan enrichPosts.
 */
const QUICK_SEARCH_POST_LIMIT = 20;
const QUICK_SEARCH_ENRICH_LIMIT = 12;

/*
 * Gunakan concurrency 1 untuk mengurangi
 * kemungkinan HTTP 429 dari Instagram.
 */
const ENRICHMENT_CONCURRENCY = 1;

function normalizeUsername(
  value: string
): string {
  return value
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
}

/*
 * Memilih postingan terbaru yang benar-benar
 * dimiliki oleh akun target.
 *
 * Post milik akun lain, termasuk post yang hanya
 * mention/tag akun target, tidak ikut benchmark ER.
 */
function selectLatestPosts(
  posts: RawPost[],
  expectedUsername: string
): RawPost[] {
  const normalizedExpected =
    normalizeUsername(expectedUsername);

  const seenUrls = new Set<string>();

  return posts
    .filter((post) => {
      const owner = normalizeUsername(
        post.ownerUsername ?? ""
      );

      if (!post.postUrl || !post.postedAt) {
        return false;
      }

      if (
        Number.isNaN(
          new Date(post.postedAt).getTime()
        )
      ) {
        return false;
      }

      if (seenUrls.has(post.postUrl)) {
        return false;
      }

      /*
       * Jika owner tersedia dan berbeda dari
       * creator yang dicari, post dibuang.
       *
       * Ini mencegah post brand/collaboration
       * milik akun lain mencampuri ER creator.
       */
      if (
        owner &&
        owner !== normalizedExpected
      ) {
        console.warn(
          `[QUICK SEARCH] Post dibuang: ` +
            `${owner} !== ${normalizedExpected}`
        );

        return false;
      }

      seenUrls.add(post.postUrl);

      return true;
    })
    .sort((a, b) => {
      return (
        new Date(b.postedAt).getTime() -
        new Date(a.postedAt).getTime()
      );
    })
    .slice(0, QUICK_SEARCH_POST_LIMIT);
}

/*
 * Score awal digunakan sebelum enrichPosts.
 *
 * shares, saves, dan reposts belum tentu tersedia
 * pada hasil bulk, jadi pemilihan awal menggunakan:
 *
 * likes + comments + 1% views.
 */
function initialPostScore(
  post: RawPost
): number {
  const likes = Number(
    post.likes ?? 0
  );

  const comments = Number(
    post.comments ?? 0
  );

  const views = Number(
    post.views ?? 0
  );

  return (
    likes +
    comments +
    views * 0.01
  );
}

/*
 * Pilih 10 postingan terbaik dari maksimal
 * 20 postingan bulk.
 */
function selectBestPosts(
  posts: RawPost[],
  limit: number
): RawPost[] {
  return [...posts]
    .sort((a, b) => {
      const scoreDifference =
        initialPostScore(b) -
        initialPostScore(a);

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      return (
        new Date(b.postedAt).getTime() -
        new Date(a.postedAt).getTime()
      );
    })
    .slice(0, limit);
}

export async function POST(
  request: NextRequest
) {
  const body = await request
    .json()
    .catch(() => null);

  const username = normalizeUsername(
    String(body?.username ?? "")
  );

  const socialMedia = String(
    body?.socialMedia ?? ""
  )
    .trim()
    .toLowerCase();

  if (!username) {
    return NextResponse.json(
      {
        inserted: false,
        error: "Username wajib diisi.",
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
        inserted: false,
        error:
          "Pilih social media terlebih dahulu.",
      },
      {
        status: 400,
      }
    );
  }

  try {
    let profile: RawProfile;

    /*
     * ========================================
     * INSTAGRAM
     * ========================================
     */
    if (socialMedia === "instagram") {
      const [details] =
        await scrapeInstagramProfileDetails([
          username,
        ]);

      if (
        !details ||
        !details.isValid
      ) {
        return NextResponse.json(
          {
            inserted: false,
            reason: "not_found",
            message:
              "Akun Instagram tidak ditemukan atau tidak valid.",
            preview: null,
          },
          {
            status: 404,
          }
        );
      }

      const bulkPosts =
        await fetchInstagramBulkPosts(
          details.username,
          undefined,
          QUICK_SEARCH_POST_LIMIT
        );

      profile = {
        ...details,

        posts: selectLatestPosts(
          bulkPosts,
          details.username
        ),
      };
    }

    /*
     * ========================================
     * TIKTOK
     * ========================================
     */
    else {
      const [tiktokProfile] =
        await scrapeTiktokProfiles(
          [username],
          undefined,
          QUICK_SEARCH_POST_LIMIT,
          {
            /*
             * Enrichment dilakukan sendiri setelah
             * 10 post terbaik dipilih.
             */
            enrichPosts: false,
          }
        );

      if (
        !tiktokProfile ||
        !tiktokProfile.isValid
      ) {
        return NextResponse.json(
          {
            inserted: false,
            reason: "not_found",
            message:
              "Akun TikTok tidak ditemukan atau tidak valid.",
            preview: null,
          },
          {
            status: 404,
          }
        );
      }

      profile = {
        ...tiktokProfile,

        posts: selectLatestPosts(
          tiktokProfile.posts,
          tiktokProfile.username
        ),
      };
    }

    /*
     * Data preview untuk respons frontend.
     */
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

      bio:
        profile.bio ?? "",

      benchmarkPostCount:
        profile.posts.length,
    };

    if (profile.posts.length === 0) {
      return NextResponse.json(
        {
          inserted: false,
          reason: "no_posts",
          message:
            "Tidak ada postingan valid milik creator yang berhasil diperoleh.",
          preview,
        },
        {
          status: 422,
        }
      );
    }

    /*
     * ========================================
     * PEMERIKSAAN AKUN INDONESIA
     * ========================================
     *
     * Kemungkinan hasil:
     *
     * indonesian:
     *   tetap diproses.
     *
     * uncertain:
     *   tetap diproses, cityId dikosongkan.
     *
     * not_indonesian confidence >= 80:
     *   tidak disimpan.
     */
    const locationCheck =
      await checkIndonesianLocation(
        profile.bio ?? "",
        profile.posts
      );

    console.log(
      "[QUICK SEARCH] Hasil pemeriksaan lokasi:",
      {
        username:
          profile.username,
        status:
          locationCheck.status,
        confidence:
          locationCheck.confidence,
        cityGuess:
          locationCheck.cityGuess,
      }
    );

    /*
     * Hanya akun yang dipastikan bukan Indonesia
     * dengan confidence minimal 80 yang dibuang.
     */
    if (
      locationCheck.status ===
        "not_indonesian" &&
      locationCheck.confidence >= 80
    ) {
      return NextResponse.json(
        {
          inserted: false,
          reason: "not_indonesia",
          message:
            "Akun terdeteksi bukan berasal dari Indonesia dan tidak disimpan.",
          locationCheck,
          preview,
        },
        {
          status: 422,
        }
      );
    }

    /*
     * Status uncertain tetap diproses.
     */
    if (
      locationCheck.status ===
      "uncertain"
    ) {
      console.warn(
        `[QUICK SEARCH] Negara asal ` +
          `${profile.username} belum dapat ` +
          `dipastikan. Akun tetap diproses.`
      );
    }

    /*
     * ========================================
     * PILIH 10 POSTINGAN TERBAIK
     * ========================================
     */
    const selectedPosts =
      selectBestPosts(
        profile.posts,
        QUICK_SEARCH_ENRICH_LIMIT
      );

    console.log(
      `[QUICK SEARCH] ` +
        `${profile.posts.length} postingan ditemukan; ` +
        `${selectedPosts.length} postingan terbaik ` +
        `akan diproses detail.`
    );

    /*
     * ========================================
     * ENRICH POSTINGAN
     * ========================================
     *
     * Mengambil detail tambahan:
     * - shares
     * - saves
     * - reposts
     * - views yang lebih akurat
     */
    const [
      enrichedPosts,
      existingCategories,
    ] = await Promise.all([
      enrichPosts(
        selectedPosts,
        socialMedia as
          | "instagram"
          | "tiktok",
        {
          concurrency:
            ENRICHMENT_CONCURRENCY,

          /*
           * Jika satu post gagal di-enrich,
           * gunakan data bulk sebagai fallback.
           */
          dropFailed: false,

          expectedUsername:
            profile.username,
        }
      ),

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
          message:
            "Postingan tidak berhasil diproses. Data lama tidak diubah.",
          preview,
        },
        {
          status: 422,
        }
      );
    }

    /*
     * Klasifikasi kategori creator menggunakan
     * hasil 10 postingan yang sudah diproses.
     */
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

    /*
     * ========================================
     * PENENTUAN KOTA
     * ========================================
     *
     * Kota hanya diisi jika:
     * - status benar-benar Indonesian;
     * - Gemini menemukan kota dari bio.
     *
     * Status uncertain tetap disimpan dengan
     * cityId kosong.
     */
    let cityId:
      | number
      | undefined;

    if (
      locationCheck.status ===
        "indonesian" &&
      locationCheck.cityGuess
    ) {
      const city =
        await prisma.mst_cities.findFirst({
          where: {
            name: {
              contains:
                locationCheck.cityGuess,

              mode: "insensitive",
            },
          },

          select: {
            id: true,
          },
        });

      cityId = city?.id;
    }

    /*
     * Cari kategori yang sudah tersedia.
     */
    let category =
      await prisma.mst_categories.findFirst({
        where: {
          name: {
            equals:
              categoryName,

            mode: "insensitive",
          },
        },
      });

    /*
     * Buat kategori jika belum tersedia.
     */
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

    /*
     * ========================================
     * SIMPAN CREATOR
     * ========================================
     *
     * Hanya 10 postingan terbaik yang disimpan.
     *
     * skipPostEnrichment = true karena postingan
     * sudah di-enrich pada route ini.
     *
     * replaceStoredPosts = true karena Quick Search
     * mengganti kumpulan benchmark creator dengan
     * hasil terbaru.
     */
    const creatorId =
      await persistCreatorProfile(
        {
          ...profile,
          posts: enrichedPosts,
        },
        {
          categoryId:
            category?.id ?? null,

          cityId,

          skipPostEnrichment: true,
          replaceStoredPosts: true,
        }
      );

    return NextResponse.json(
      {
        inserted: true,
        creatorId,

        postCount:
          enrichedPosts.length,

        message:
          `${enrichedPosts.length} postingan terbaik ` +
          `berhasil diproses dan disimpan.`,

        locationStatus:
          locationCheck.status,

        locationConfidence:
          locationCheck.confidence,

        preview: {
          ...preview,

          benchmarkPostCount:
            enrichedPosts.length,

          categoryName:
            category?.name ??
            categoryName,

          locationStatus:
            locationCheck.status,
        },
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "[QUICK SEARCH ERROR]",
      error
    );

    const detail =
      error instanceof Error
        ? error.message
        : "Unknown error";

    return NextResponse.json(
      {
        inserted: false,
        error:
          "Gagal melakukan scraping. Silakan coba lagi.",

        detail:
          process.env.NODE_ENV ===
          "development"
            ? detail
            : undefined,
      },
      {
        status: 500,
      }
    );
  }
}