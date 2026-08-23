import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { inferSowPlatform } from "@/lib/social-platform";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const { sow_nama } = await req.json();
    const normalizedName = String(sow_nama ?? "").trim();
    if (!normalizedName) return NextResponse.json({ error: "SOW name is required" }, { status: 400 });
    if (!inferSowPlatform(normalizedName)) {
      return NextResponse.json({ error: "SOW name must include a recognized platform: Instagram/IG, TikTok, YouTube, or Twitter/X" }, { status: 400 });
    }

    const data = await prisma.mst_sow.update({
      where: { sow_id: parseInt(id) },
      data: {
        sow_nama: normalizedName,
        modiby: session.user.name || "admin",
        modidate: new Date(),
      },
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update SOW" }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    await prisma.mst_sow.update({
      where: { sow_id: parseInt(id) },
      data: {
        sow_status: 0,
        modiby: session.user.name || "admin",
        modidate: new Date(),
      },
    });

    return NextResponse.json({ success: true, message: "SOW deactivated successfully" });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete SOW" }, { status: 500 });
  }
}
