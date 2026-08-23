import { PrismaClient } from "@prisma/client";
import { notFound } from "next/navigation";
import CreatorDetailClient from "./CreatorDetailClient";

const prisma = new PrismaClient();

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const creatorId = Number(id);

  if (isNaN(creatorId)) return notFound();

  // ambil profile dari mst_creators
  const creator = await prisma.mst_creators.findUnique({
    where: {
      id: creatorId,
    },
  });

  if (!creator) {
    return notFound();
  }

  // hitung jumlah post asli dari dtl_creator_posts
  const totalPosts = await prisma.dtl_creator_posts.count({
    where: {
      creator_id: creatorId,
    },
  });

  // ambil top 5 content terbaru
  const topPosts = await prisma.dtl_creator_posts.findMany({
    where: {
      creator_id: creatorId,
    },

    orderBy: {
      posted_at: "desc",
    },

    take: 5,

    select: {
      id: true,
      post_url: true,
      thumbnail_url: true,
      caption: true,
      likes: true,
      comments: true,
      views: true,
      shares: true,
      saves: true,
      reposts: true,
      posted_at: true,
    },
  });

  return (
    <CreatorDetailClient
      profile={{
        id: creator.id,

        name: creator.name,

        username: creator.username,

        photoUrl: creator.photo_url,

        followers: creator.followers ?? 0,

        following: creator.following ?? null,

        socialMedia: creator.social_media,

        // dari mst_creators
        totalPost: creator.total_post ?? 0,

        // dari dtl_creator_posts
        totalPosts: totalPosts,

        lastScrapedAt: creator.last_scraped_at
          ? creator.last_scraped_at.toISOString()
          : null,

        // ======================
        // mst_creators metrics
        // ======================

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

        // jsonb postgres
        topHashtags: Array.isArray(creator.top_hashtags)
          ? (creator.top_hashtags as {
              tag: string;
              count: number;
            }[])
          : [],

        topMentions: Array.isArray(creator.top_mentions)
          ? (creator.top_mentions as {
              mention: string;
              count: number;
            }[])
          : [],
      }}
      posts={topPosts.map((p) => ({
        id: p.id,

        postUrl: p.post_url ?? "",

        thumbnailUrl: p.thumbnail_url ?? undefined,

        caption: p.caption ?? "",

        likes: p.likes ?? 0,

        comments: p.comments ?? 0,

        views: p.views ?? 0,

        shares: p.shares,

        saves: p.saves,

        reposts: p.reposts,

        postedAt: p.posted_at ? p.posted_at.toISOString() : "",
      }))}
    />
  );
}
