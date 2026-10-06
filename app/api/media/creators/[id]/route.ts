import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const { id } = await context.params;
    const creatorId = Number(id);

    if (
      !Number.isInteger(creatorId) ||
      creatorId <= 0
    ) {
      return Response.json(
        {
          error: "Invalid creator ID",
        },
        {
          status: 400,
        }
      );
    }

    const creator =
      await prisma.mst_creators.findUnique({
        where: {
          id: creatorId,
        },
        select: {
          photo_data: true,
          photo_mime_type: true,
          photo_updated_at: true,
        },
      });

    if (
      !creator?.photo_data ||
      creator.photo_data.byteLength === 0
    ) {
      return Response.json(
        {
          error: "Profile image not found",
        },
        {
          status: 404,
        }
      );
    }

    const imageBuffer = Buffer.from(
      creator.photo_data
    );

    const contentType =
      creator.photo_mime_type?.trim() ||
      "image/webp";

    return new Response(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(
          imageBuffer.byteLength
        ),
        "Cache-Control":
          "public, max-age=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(
      "[CREATOR MEDIA] Failed to load profile image:",
      error
    );

    return Response.json(
      {
        error: "Failed to load profile image",
      },
      {
        status: 500,
      }
    );
  }
}