import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

const MAX_CREATORS_PER_REQUEST = 20;

export async function POST(request: Request) {
  const session = await getServerSession(
    authOptions
  );

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

    const rawIds: unknown[] =
      Array.isArray(body?.creatorIds)
        ? body.creatorIds
        : [];

    const ids = [
      ...new Set(
        rawIds
          .map((value) =>
            Number(value)
          )
          .filter(
            (id) =>
              Number.isInteger(id) &&
              id > 0
          )
      ),
    ].slice(
      0,
      MAX_CREATORS_PER_REQUEST
    );

    if (ids.length === 0) {
      return NextResponse.json({
        photos: [],
        refreshed: 0,
      });
    }

    /*
     * Hanya membaca foto yang sudah tersimpan.
     *
     * Endpoint ini tidak menjalankan scraping
     * dan tidak menggunakan token Apify.
     */
    const creators =
      await prisma.mst_creators.findMany({
        where: {
          id: {
            in: ids,
          },
        },

        select: {
          id: true,
          photo_url: true,
        },
      });

    return NextResponse.json({
      photos: creators.map(
        (creator) => ({
          id: creator.id,
          photo_url:
            creator.photo_url,
        })
      ),

      /*
       * Tidak ada foto yang diperbarui
       * karena endpoint hanya membaca database.
       */
      refreshed: 0,
    });
  } catch (error) {
    console.error(
      "PROFILE PHOTO LOAD ERROR:",
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