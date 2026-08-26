import {
  NextRequest,
  NextResponse,
} from "next/server";

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

import {
  persistCreatorProfile,
} from "@/lib/creator-processor";

import {
  firstProfileImageUrl,
} from "@/lib/profile-image";

import {
  prisma,
} from "@/lib/prisma";

/*
 * Beri batas waktu di bawah maksimum
 * lima menit Vercel.
 */
export const maxDuration = 280;

/*
 * Quick Search hanya mengambil
 * 12 postingan terbaru.
 */
const QUICK_SEARCH_POST_LIMIT = 12;

/*
 * Enrichment dijalankan satu per satu.
 */
const ENRICHMENT_CONCURRENCY = 1;

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
  )
    .trim()
    .toLowerCase();

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
        error:
          "Pilih social media terlebih dahulu",
      },
      {
        status: 400,
      }
    );
  }

  try {
    /*
     * ========================================================
     * STEP 1 — AMBIL PROFILE DAN BULK POST
     * ========================================================
     */

    let profile;

    if (socialMedia === "instagram") {
      /*
       * Ambil detail profile terlebih dahulu.
       */
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
            "Akun tidak ditemukan atau tidak valid.",
          preview: null,
        });
      }

      /*
       * Hanya mengambil maksimal 12 post.
       */
      const bulkPosts =
        await fetchInstagramBulkPosts(
          details.username,
          undefined,
          QUICK_SEARCH_POST_LIMIT
        );

      profile = {
        ...details,

        /*
         * Pastikan tetap maksimal 12 post,
         * walaupun Actor mengembalikan lebih.
         */
        posts: bulkPosts
          .sort(
            (a, b) =>
              new Date(
                b.postedAt
              ).getTime() -
              new Date(
                a.postedAt
              ).getTime()
          )
          .slice(
            0,
            QUICK_SEARCH_POST_LIMIT
          ),
      };
    } else {
      /*
       * TikTok juga hanya mengambil 12 post.
       *
       * enrichPosts: false karena enrichment
       * dilakukan setelah pengecekan Indonesia.
       */
      const [tiktokProfile] =
        await scrapeTiktokProfiles(
          [username],
          undefined,
          QUICK_SEARCH_POST_LIMIT,
          {
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
            "Akun tidak ditemukan atau tidak valid.",
          preview: null,
        });
      }

      profile = {
        ...tiktokProfile,
        posts: tiktokProfile.posts
          .sort(
            (a, b) =>
              new Date(
                b.postedAt
              ).getTime() -
              new Date(
                a.postedAt
              ).getTime()
          )
          .slice(
            0,
            QUICK_SEARCH_POST_LIMIT
          ),
      };
    }

    /*
     * Jangan lanjut apabila Actor tidak
     * mengembalikan postingan.
     */
    if (profile.posts.length === 0) {
      return NextResponse.json(
        {
          inserted: false,
          reason: "no_posts",
          message:
            "Tidak ada postingan yang berhasil diambil.",
          preview: null,
        },
        {
          status: 422,
        }
      );
    }

    /*
     * ========================================================
     * STEP 2 — BUAT PREVIEW
     * ========================================================
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

      photoUrl:
        firstProfileImageUrl([
          ...(profile.photoUrls ?? []),
          profile.photoUrl,
        ]),

      bio:
        profile.bio ?? "",

      benchmarkPostCount:
        profile.posts.length,
    };

    /*
     * ========================================================
     * STEP 3 — CEK LOKASI INDONESIA
     * ========================================================
     *
     * Dilakukan sebelum enrichment agar akun
     * yang ditolak tidak menghabiskan banyak
     * request Apify.
     */

    const locationCheck =
      await checkIndonesianLocation(
        profile.bio ?? "",
        profile.posts
      );

    if (
      !locationCheck.isIndonesian
    ) {
      return NextResponse.json({
        inserted: false,
        reason: "not_indonesia",
        message:
          "Akun terdeteksi bukan dari Indonesia — tidak disimpan ke database.",
        preview,
      });
    }

    /*
     * ========================================================
     * STEP 4 — ENRICHMENT POST SATU PER SATU
     * ========================================================
     *
     * concurrency: 1 berarti Actor detail
     * hanya memproses satu URL pada satu waktu.
     *
     * Jika satu post gagal enrichment,
     * fungsi enrichPosts akan menggunakan
     * data bulk sebagai fallback.
     */

    const [
      enrichedPosts,
      existingCategories,
    ] = await Promise.all([
      enrichPosts(
        profile.posts.slice(
          0,
          QUICK_SEARCH_POST_LIMIT
        ),
        socialMedia as
          | "instagram"
          | "tiktok",
        {
          concurrency:
            ENRICHMENT_CONCURRENCY,
        }
      ),

      prisma.mst_categories.findMany({
        select: {
          name: true,
        },
      }),
    ]);

    /*
     * Jangan simpan jika tidak ada post
     * yang dapat dikembalikan.
     */
    if (
      enrichedPosts.length === 0
    ) {
      return NextResponse.json(
        {
          inserted: false,
          reason: "enrichment_failed",
          message:
            "Postingan tidak berhasil diproses.",
          preview,
        },
        {
          status: 422,
        }
      );
    }

    /*
     * ========================================================
     * STEP 5 — KLASIFIKASI KATEGORI
     * ========================================================
     */

    const categoryName =
      await classifyAccountCategory(
        profile.username,
        profile.bio ?? "",

        /*
         * Gunakan post hasil enrichment,
         * bukan post mentah.
         */
        enrichedPosts,

        existingCategories.map(
          (category) =>
            category.name
        )
      );

    /*
     * ========================================================
     * STEP 6 — CARI CITY
     * ========================================================
     */

    let cityId:
      | number
      | undefined;

    if (
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
        });

      cityId = city?.id;
    }

    /*
     * ========================================================
     * STEP 7 — CARI ATAU BUAT KATEGORI
     * ========================================================
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

    if (
      !category &&
      categoryName
    ) {
      category =
        await prisma.mst_categories.create({
          data: {
            name:
              categoryName,
          },
        });
    }

    /*
     * ========================================================
     * STEP 8 — SIMPAN CREATOR DAN 12 POST
     * ========================================================
     */

    const creatorId =
      await persistCreatorProfile(
        {
          ...profile,

          /*
           * Maksimal berisi 12 post.
           */
          posts:
            enrichedPosts.slice(
              0,
              QUICK_SEARCH_POST_LIMIT
            ),
        },
        {
          categoryId:
            category?.id ?? null,

          cityId,
        }
      );

    /*
     * ========================================================
     * STEP 9 — RESPONSE
     * ========================================================
     */

    return NextResponse.json({
      inserted: true,
      creatorId,

      postCount:
        enrichedPosts.length,

      message:
        `${enrichedPosts.length} postingan berhasil diproses.`,

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

    return NextResponse.json(
      {
        inserted: false,
        error:
          "Gagal melakukan scraping, coba lagi.",
      },
      {
        status: 500,
      }
    );
  }
}