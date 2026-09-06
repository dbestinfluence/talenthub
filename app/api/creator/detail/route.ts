import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");
    const id = Number(idParam);

    if (!idParam || !Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Invalid creator id" },
        { status: 400 }
      );
    }

    const creator = await prisma.mst_creators.findUnique({
      where: { id },
    });

    if (!creator) {
      return NextResponse.json(
        { error: "Creator not found" },
        { status: 404 }
      );
    }

    // Ambil post. Pembatasan Top 5 dilakukan khusus di frontend.
    const posts = await prisma.dtl_creator_posts.findMany({
      where: { creator_id: id },
      orderBy: { posted_at: "desc" },
    });

    return NextResponse.json({
      profile: {
        id: creator.id,
        name: creator.name,
        username: creator.username,
        photoUrl: creator.photo_url,
        followers: creator.followers ?? 0,
        following: creator.following ?? 0,
        socialMedia: creator.social_media,
        totalPost: creator.total_post ?? 0,
        averageView: creator.average_view ?? 0,
        averageViewBrand: creator.average_view_brand ?? 0,
        avgLikes: creator.avg_likes ?? 0,
        avgComments: creator.avg_comments ?? 0,
        avgShares: creator.avg_shares ?? 0,
        avgSaves: creator.avg_saves ?? 0,
        avgReposts: creator.avg_reposts ?? 0,
        erFollowers: Number(creator.er_followers ?? 0),
        erViews: Number(creator.er_views ?? 0),
        erTalenthub: Number(creator.er_talenthub ?? 0),
        topHashtags: creator.top_hashtags ?? [],
        topMentions: creator.top_mentions ?? [],
        lastScrapedAt: creator.last_scraped_at
          ? creator.last_scraped_at.toISOString()
          : null,
      },

      posts: posts.map((post) => ({
        id: post.id,
        postUrl: post.post_url ?? "",
        thumbnailUrl: post.thumbnail_url ?? "",
        caption: post.caption ?? "",
        likes: Number(post.likes ?? 0),
        comments: Number(post.comments ?? 0),
        views: Number(post.views ?? 0),
        shares: post.shares == null ? null : Number(post.shares),
        saves: post.saves == null ? null : Number(post.saves),
        reposts: post.reposts == null ? null : Number(post.reposts),
        postedAt: post.posted_at ? post.posted_at.toISOString() : "",
      })),
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[CREATOR DETAIL API ERROR]", error);

    return NextResponse.json(
      { error: "Failed to load creator detail" },
      { status: 500 }
    );
  }
}