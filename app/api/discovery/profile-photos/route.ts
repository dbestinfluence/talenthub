import { authOptions } from "@/auth";
import { scrapeInstagramProfiles, scrapeTiktokProfiles, type RawProfile } from "@/lib/apify";
import { firstProfileImageUrl } from "@/lib/profile-image";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

const MAX_CREATORS_PER_REQUEST = 20;

function normalizedUsername(value: string): string {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

async function scrapeByPlatform(platform: string, usernames: string[]): Promise<RawProfile[]> {
  if (!usernames.length) return [];
  if (platform === "instagram") return scrapeInstagramProfiles(usernames);
  if (platform === "tiktok") return scrapeTiktokProfiles(usernames);
  return [];
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const rawIds: unknown[] = Array.isArray(body?.creatorIds) ? body.creatorIds : [];
    const ids: number[] = [...new Set<number>(
      rawIds.map((value) => Number(value)).filter((id) => Number.isInteger(id) && id > 0),
    )].slice(0, MAX_CREATORS_PER_REQUEST);

    if (!ids.length) return NextResponse.json({ photos: [] });

    const creators = await prisma.mst_creators.findMany({
      where: { id: { in: ids } },
      select: { id: true, username: true, social_media: true, photo_url: true },
    });

    const needsRefresh = creators;
    const groups = new Map<string, typeof needsRefresh>();
    for (const creator of needsRefresh) {
      const platform = creator.social_media.trim().toLowerCase();
      if (platform !== "instagram" && platform !== "tiktok") continue;
      groups.set(platform, [...(groups.get(platform) ?? []), creator]);
    }

    const updatedPhotos = new Map<number, string>();
    for (const [platform, platformCreators] of groups) {
      const profiles = await scrapeByPlatform(
        platform,
        platformCreators.map((creator) => normalizedUsername(creator.username)),
      );
      const profilesByUsername = new Map(
        profiles.map((profile) => [normalizedUsername(profile.username), profile]),
      );

      for (const creator of platformCreators) {
        const profile = profilesByUsername.get(normalizedUsername(creator.username));
        if (!profile?.isValid) continue;
        const photo = firstProfileImageUrl([
          ...(profile.photoUrls ?? []),
          profile.photoUrl,
        ]);
        if (!photo) continue;

        await prisma.mst_creators.update({
          where: { id: creator.id },
          data: { photo_url: photo, updated_at: new Date(), last_scraped_at: new Date() },
        });
        updatedPhotos.set(creator.id, photo);
      }
    }

    return NextResponse.json({
      photos: creators.map((creator) => ({
        id: creator.id,
        photo_url: updatedPhotos.get(creator.id) ?? creator.photo_url,
      })),
    });
  } catch (error) {
    console.error("PROFILE PHOTO REFRESH ERROR:", error);
    return NextResponse.json({ error: "Failed to refresh creator profile photos" }, { status: 500 });
  }
}
