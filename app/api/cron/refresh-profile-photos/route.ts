import { scrapeInstagramProfiles, scrapeTiktokProfiles, type RawProfile } from "@/lib/apify";
import { firstProfileImageUrl } from "@/lib/profile-image";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BATCH_SIZE = 25;

function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

function chunks<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

async function scrapeProfiles(platform: string, usernames: string[]): Promise<RawProfile[]> {
  if (platform === "instagram") return scrapeInstagramProfiles(usernames );
  // The daily job also refreshes creator content thumbnails and metrics.
  if (platform === "tiktok") return scrapeTiktokProfiles(usernames);
  return [];
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const creators = await prisma.mst_creators.findMany({
    where: { social_media: { in: ["instagram", "tiktok"], mode: "insensitive" } },
    select: { id: true, username: true, social_media: true },
    orderBy: { id: "asc" },
  });

  let updated = 0;
  let updatedPosts = 0;
  const failures: Array<{ platform: string; usernames: string[]; reason: string }> = [];

  for (const platform of ["instagram", "tiktok"] as const) {
    const platformCreators = creators.filter(
      (creator) => creator.social_media.trim().toLowerCase() === platform,
    );

    for (const batch of chunks(platformCreators, BATCH_SIZE)) {
      try {
        const profiles = await scrapeProfiles(
          platform,
          batch.map((creator) => normalizeUsername(creator.username)),
        );
        const profileLookup = new Map(
          profiles.map((profile) => [normalizeUsername(profile.username), profile]),
        );
        const updates = batch.flatMap((creator) => {
          const profile = profileLookup.get(normalizeUsername(creator.username));
          const photoUrl = profile?.isValid
            ? firstProfileImageUrl([...(profile.photoUrls ?? []), profile.photoUrl])
            : null;
          return profile && photoUrl ? [{ creator, profile, photoUrl }] : [];
        });

        for (const item of updates) {
          const validPosts = item.profile.posts
            .filter((post) => post.postedAt && !Number.isNaN(new Date(post.postedAt).getTime()))
            .sort((left, right) => right.likes - left.likes)
            .slice(0, 5);
          await prisma.$transaction([
            prisma.mst_creators.update({
              where: { id: item.creator.id },
              data: {
                photo_url: item.photoUrl,
                last_scraped_at: new Date(),
                updated_at: new Date(),
              },
            }),
            ...validPosts.map((post) => prisma.dtl_creator_posts.upsert({
              where: {
                uq_creator_post: {
                  creator_id: item.creator.id,
                  posted_at: new Date(post.postedAt),
                  caption: post.caption,
                },
              },
              update: {
                post_url: post.postUrl,
                thumbnail_url: post.thumbnailUrl,
                likes: post.likes,
                comments: post.comments,
                views: post.views,
                scraped_at: new Date(),
              },
              create: {
                creator_id: item.creator.id,
                post_url: post.postUrl,
                thumbnail_url: post.thumbnailUrl,
                caption: post.caption,
                likes: post.likes,
                comments: post.comments,
                views: post.views,
                posted_at: new Date(post.postedAt),
                scraped_at: new Date(),
              },
            })),
          ]);
          updated += 1;
          updatedPosts += validPosts.length;
        }
      } catch (error) {
        failures.push({
          platform,
          usernames: batch.map((creator) => creator.username),
          reason: error instanceof Error ? error.message : "Unknown scraper error",
        });
      }
    }
  }

  return NextResponse.json({
    total: creators.length,
    updated,
    updatedPosts,
    failedBatches: failures.length,
    failures,
    refreshedAt: new Date().toISOString(),
  });
}
