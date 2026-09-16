import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CreatorDetailClient from "./CreatorDetailClient";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const creatorId = Number(id);

  if (!Number.isInteger(creatorId) || creatorId <= 0) {
    notFound();
  }

  const [creator, posts] = await Promise.all([
    prisma.mst_creators.findUnique({
      where: { id: creatorId },
    }),
    prisma.dtl_creator_posts.findMany({
      where: { creator_id: creatorId },
      orderBy: { posted_at: "desc" },
  
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
    }),
  ]);

  if (!creator) {
    notFound();
  }

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
        totalPost: creator.total_post ?? 0,
        totalPosts: posts.length,
        lastScrapedAt: creator.last_scraped_at
          ? creator.last_scraped_at.toISOString()
          : null,
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
        topHashtags: Array.isArray(creator.top_hashtags)
          ? (creator.top_hashtags as { tag: string; count: number }[])
          : [],
        topMentions: Array.isArray(creator.top_mentions)
          ? (creator.top_mentions as { mention: string; count: number }[])
          : [],
      }}
      posts={posts.map((post) => ({
        id: post.id,
        postUrl: post.post_url ?? "",
        thumbnailUrl: post.thumbnail_url ?? undefined,
        caption: post.caption ?? "",
        likes: post.likes ?? 0,
        comments: post.comments ?? 0,
        views: post.views ?? 0,
        shares: post.shares,
        saves: post.saves,
        reposts: post.reposts,
        postedAt: post.posted_at?.toISOString() ?? "",
      }))}
    />
  );
}
