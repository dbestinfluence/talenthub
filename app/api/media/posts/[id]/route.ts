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
    const postId = Number(id);

    if (
      !Number.isInteger(postId) ||
      postId <= 0
    ) {
      return Response.json(
        {
          error: "Invalid post ID",
        },
        {
          status: 400,
        }
      );
    }

    const post =
      await prisma.dtl_creator_posts.findUnique({
        where: {
          id: postId,
        },
        select: {
          thumbnail_data: true,
          thumbnail_mime_type: true,
          thumbnail_updated_at: true,
        },
      });

    if (
      !post?.thumbnail_data ||
      post.thumbnail_data.byteLength === 0
    ) {
      return Response.json(
        {
          error: "Thumbnail not found",
        },
        {
          status: 404,
        }
      );
    }

    const imageBuffer = Buffer.from(
      post.thumbnail_data
    );

    const contentType =
      post.thumbnail_mime_type?.trim() ||
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
      "[POST MEDIA] Failed to load thumbnail:",
      error
    );

    return Response.json(
      {
        error: "Failed to load thumbnail",
      },
      {
        status: 500,
      }
    );
  }
}