import { authOptions } from "@/auth";
import {
  scrapeInstagramProfiles,
  scrapeTiktokProfiles,
  type RawProfile,
} from "@/lib/apify";
import { firstProfileImageUrl } from "@/lib/profile-image";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

const MAX_CREATORS_PER_REQUEST = 20;

function normalizedUsername(value: string): string {
  return String(value ?? "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
}

function normalizedPlatform(value: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function hasStoredPhoto(
  photoUrl: string | null | undefined
): boolean {
  return Boolean(
    firstProfileImageUrl([photoUrl])
  );
}

async function scrapeByPlatform(
  platform: string,
  usernames: string[]
): Promise<RawProfile[]> {
  if (usernames.length === 0) {
    return [];
  }

  if (platform === "instagram") {
    return scrapeInstagramProfiles(usernames);
  }

  if (platform === "tiktok") {
    return scrapeTiktokProfiles(usernames);
  }

  return [];
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  try {
    const body = await request
      .json()
      .catch(() => ({}));

    const rawIds: unknown[] = Array.isArray(
      body?.creatorIds
    )
      ? body.creatorIds
      : [];

    const ids = [
      ...new Set(
        rawIds
          .map((value) => Number(value))
          .filter(
            (id) =>
              Number.isInteger(id) &&
              id > 0
          )
      ),
    ].slice(0, MAX_CREATORS_PER_REQUEST);

    if (ids.length === 0) {
      return NextResponse.json({
        photos: [],
      });
    }

    const creators =
      await prisma.mst_creators.findMany({
        where: {
          id: {
            in: ids,
          },
        },

        select: {
          id: true,
          username: true,
          social_media: true,
          photo_url: true,
        },
      });

    /*
     * Hanya scrape creator yang belum mempunyai
     * photo_url valid.
     *
     * Creator yang fotonya sudah tersimpan tidak
     * memanggil Apify lagi.
     */
    const needsRefresh = creators.filter(
      (creator) =>
        !hasStoredPhoto(creator.photo_url)
    );

    /*
     * Kalau seluruh creator sudah mempunyai foto,
     * langsung kembalikan data database.
     * Tidak ada token Apify yang digunakan.
     */
    if (needsRefresh.length === 0) {
      return NextResponse.json({
        photos: creators.map((creator) => ({
          id: creator.id,
          photo_url: creator.photo_url,
        })),

        refreshed: 0,
      });
    }

    const groups = new Map<
      string,
      typeof needsRefresh
    >();

    for (const creator of needsRefresh) {
      const platform = normalizedPlatform(
        creator.social_media
      );

      if (
        platform !== "instagram" &&
        platform !== "tiktok"
      ) {
        continue;
      }

      const currentGroup =
        groups.get(platform) ?? [];

      currentGroup.push(creator);

      groups.set(platform, currentGroup);
    }

    const updatedPhotos =
      new Map<number, string>();

    const warnings: string[] = [];

    for (
      const [platform, platformCreators]
      of groups
    ) {
      try {
        const usernames = platformCreators
          .map((creator) =>
            normalizedUsername(
              creator.username
            )
          )
          .filter(Boolean);

        if (usernames.length === 0) {
          continue;
        }

        const profiles = await scrapeByPlatform(
          platform,
          usernames
        );

        const profilesByUsername = new Map(
          profiles.map((profile) => [
            normalizedUsername(
              profile.username
            ),
            profile,
          ])
        );

        for (const creator of platformCreators) {
          const username = normalizedUsername(
            creator.username
          );

          const profile =
            profilesByUsername.get(username);

          if (!profile?.isValid) {
            continue;
          }

          const photo =
            firstProfileImageUrl([
              ...(profile.photoUrls ?? []),
              profile.photoUrl,
            ]);

          if (!photo) {
            continue;
          }

          await prisma.mst_creators.update({
            where: {
              id: creator.id,
            },

            data: {
              photo_url: photo,

              updated_at: new Date(),

              /*
               * Jangan update last_scraped_at di sini.
               * Endpoint ini hanya mengambil foto,
               * bukan melakukan full scraping.
               */
            },
          });

          updatedPhotos.set(
            creator.id,
            photo
          );
        }
      } catch (error) {
        /*
         * Jika token Apify habis, endpoint tetap
         * mengembalikan foto yang sudah ada.
         * Jangan membuat seluruh request menjadi 500.
         */
        const message =
          error instanceof Error
            ? error.message
            : "Unknown scraping error";

        console.error(
          `[PROFILE PHOTO REFRESH ${platform.toUpperCase()} ERROR]`,
          error
        );

        warnings.push(
          `${platform}: ${message}`
        );
      }
    }

    return NextResponse.json({
      photos: creators.map((creator) => ({
        id: creator.id,

        photo_url:
          updatedPhotos.get(creator.id) ??
          creator.photo_url,
      })),

      refreshed: updatedPhotos.size,

      warnings,
    });
  } catch (error) {
    console.error(
      "PROFILE PHOTO REFRESH ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load creator profile photos",
      },
      {
        status: 500,
      }
    );
  }
}