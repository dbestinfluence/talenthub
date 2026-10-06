import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const idParam = searchParams.get("id");
    const creatorId = Number(idParam);

    if (
      !idParam ||
      !Number.isInteger(creatorId) ||
      creatorId <= 0
    ) {
      return NextResponse.json(
        {
          error: "Invalid creator id",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Gunakan select supaya photo_data tidak ikut diambil.
     * Binary gambar hanya dibaca oleh endpoint /api/media.
     */
    const creator =
      await prisma.mst_creators.findUnique({
        where: {
          id: creatorId,
        },
        select: {
          id: true,
          name: true,
          username: true,
          photo_url: true,
          photo_mime_type: true,
          photo_updated_at: true,

          followers: true,
          following: true,
          social_media: true,
          total_post: true,

          average_view: true,
          average_view_brand: true,

          avg_likes: true,
          avg_comments: true,
          avg_shares: true,
          avg_saves: true,
          avg_reposts: true,

          er_followers: true,
          er_views: true,
          er_talenthub: true,

          top_hashtags: true,
          top_mentions: true,

          last_scraped_at: true,
        },
      });

    if (!creator) {
      return NextResponse.json(
        {
          error: "Creator not found",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * Jangan mengambil thumbnail_data di endpoint ini.
     * Mengambil BYTEA untuk semua post akan membuat query
     * dan penggunaan memory menjadi berat.
     */
    const posts =
      await prisma.dtl_creator_posts.findMany({
        where: {
          creator_id: creatorId,
        },
        orderBy: [
          {
            is_top_content: "desc",
          },
          {
            posted_at: "desc",
          },
        ],
        select: {
          id: true,
          post_url: true,
          thumbnail_url: true,
          thumbnail_mime_type: true,
          thumbnail_updated_at: true,

          caption: true,
          likes: true,
          comments: true,
          views: true,
          shares: true,
          saves: true,
          reposts: true,

          posted_at: true,
          scraped_at: true,
          is_endorse: true,
          is_top_content: true,
          category_ai: true,
        },
      });

    /*
     * Gunakan endpoint internal sebagai fallback.
     * Jadi jika thumbnail_url masih NULL tetapi post merupakan
     * Top Content, frontend tetap mencoba mengambil binary Neon.
     */
    const mappedPosts = posts.map((post) => {
      const internalThumbnailUrl =
        `/api/media/posts/${post.id}`;

      const thumbnailUrl =
        post.thumbnail_url?.trim() ||
        (post.is_top_content
          ? internalThumbnailUrl
          : "");

      return {
        id: post.id,

        postUrl: post.post_url ?? "",
        thumbnailUrl,

        caption: post.caption ?? "",

        likes: Number(post.likes ?? 0),
        comments: Number(post.comments ?? 0),
        views: Number(post.views ?? 0),

        shares:
          post.shares == null
            ? null
            : Number(post.shares),

        saves:
          post.saves == null
            ? null
            : Number(post.saves),

        reposts:
          post.reposts == null
            ? null
            : Number(post.reposts),

        postedAt: post.posted_at
          ? post.posted_at.toISOString()
          : null,

        scrapedAt: post.scraped_at
          ? post.scraped_at.toISOString()
          : null,

        thumbnailUpdatedAt:
          post.thumbnail_updated_at
            ? post.thumbnail_updated_at.toISOString()
            : null,

        thumbnailMimeType:
          post.thumbnail_mime_type ?? null,

        isTopContent:
          post.is_top_content ?? false,

        isEndorse:
          post.is_endorse ?? false,

        categoryAi:
          post.category_ai ?? null,
      };
    });

    /*
     * URL foto profil diarahkan ke endpoint binary Neon.
     * photo_updated_at digunakan sebagai cache version.
     */
    const photoVersion =
      creator.photo_updated_at?.getTime() ??
      creatorId;

    const internalPhotoUrl =
      `/api/media/creators/${creator.id}` +
      `?v=${photoVersion}`;

    const photoUrl =
      creator.photo_url?.trim()
        ? creator.photo_url.startsWith(
            "/api/media/creators/"
          )
          ? `${creator.photo_url}?v=${photoVersion}`
          : creator.photo_url
        : internalPhotoUrl;

    return NextResponse.json(
      {
        profile: {
          id: creator.id,
          name: creator.name,
          username: creator.username,

          photoUrl,
          photoMimeType:
            creator.photo_mime_type ?? null,

          followers:
            creator.followers ?? 0,

          following:
            creator.following ?? 0,

          socialMedia:
            creator.social_media,

          totalPost:
            creator.total_post ?? 0,

          averageView:
            creator.average_view ?? 0,

          averageViewBrand:
            creator.average_view_brand ?? 0,

          avgLikes:
            creator.avg_likes ?? 0,

          avgComments:
            creator.avg_comments ?? 0,

          avgShares:
            creator.avg_shares ?? 0,

          avgSaves:
            creator.avg_saves ?? 0,

          avgReposts:
            creator.avg_reposts ?? 0,

          erFollowers: Number(
            creator.er_followers ?? 0
          ),

          erViews: Number(
            creator.er_views ?? 0
          ),

          erTalenthub: Number(
            creator.er_talenthub ?? 0
          ),

          topHashtags:
            creator.top_hashtags ?? [],

          topMentions:
            creator.top_mentions ?? [],

          lastScrapedAt:
            creator.last_scraped_at
              ? creator.last_scraped_at.toISOString()
              : null,
        },

        posts: mappedPosts,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error(
      "[CREATOR DETAIL API ERROR]",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to load creator detail",
      },
      {
        status: 500,
      }
    );
  }
}