import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CreatorDetailClient from "./CreatorDetailClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type HashtagItem = {
  tag: string;
  count: number;
};

type MentionItem = {
  mention: string;
  count: number;
};

export default async function Page({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;
  const creatorId = Number(id);

  if (
    !Number.isInteger(creatorId) ||
    creatorId <= 0
  ) {
    notFound();
  }

  const [creator, posts] = await Promise.all([
    prisma.mst_creators.findUnique({
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

        last_scraped_at: true,

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
      },
    }),

    prisma.dtl_creator_posts.findMany({
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

        is_top_content: true,
        is_endorse: true,
        category_ai: true,
      },
    }),
  ]);

  if (!creator) {
    notFound();
  }

  const photoVersion =
    creator.photo_updated_at?.getTime() ??
    creator.id;

  /*
   * Gunakan endpoint binary Neon secara langsung.
   * Tidak bergantung lagi pada URL Instagram/Vercel.
   */
  const profilePhotoUrl =
    `/api/media/creators/${creator.id}` +
    `?v=${photoVersion}`;

  const mappedPosts = posts.map((post) => {
    const thumbnailVersion =
      post.thumbnail_updated_at?.getTime() ??
      post.id;

    /*
     * Hanya post berstatus Top Content yang memiliki
     * thumbnail binary permanen di Neon.
     */
    const thumbnailUrl =
      post.is_top_content
        ? `/api/media/posts/${post.id}` +
          `?v=${thumbnailVersion}`
        : undefined;

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

      postedAt:
        post.posted_at?.toISOString() ?? "",

      scrapedAt:
        post.scraped_at?.toISOString() ?? "",

      thumbnailUpdatedAt:
        post.thumbnail_updated_at?.toISOString() ??
        null,

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

  return (
    <CreatorDetailClient
      profile={{
        id: creator.id,
        name: creator.name,
        username: creator.username,

        photoUrl: profilePhotoUrl,

        followers:
          creator.followers ?? 0,

        following:
          creator.following ?? null,

        socialMedia:
          creator.social_media,

        totalPost:
          creator.total_post ?? 0,

        totalPosts:
          posts.length,

        lastScrapedAt:
          creator.last_scraped_at
            ? creator.last_scraped_at.toISOString()
            : null,

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
          Array.isArray(creator.top_hashtags)
            ? (creator.top_hashtags as HashtagItem[])
            : [],

        topMentions:
          Array.isArray(creator.top_mentions)
            ? (creator.top_mentions as MentionItem[])
            : [],
      }}
      posts={mappedPosts}
    />
  );
}