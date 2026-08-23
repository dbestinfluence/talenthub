import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { inferSowPlatform } from "@/lib/social-platform";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await prisma.mst_sow.findMany({
      where: {
        sow_status: {
          in: [1, 2],
        },
      },
      orderBy: {
        sow_id: "desc",
      },
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("GET SOW ERROR:", error);
    return NextResponse.json({ error: "Failed to load SOW data" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { sow_nama } = await req.json();
    const normalizedName = String(sow_nama ?? "").trim();

    if (!normalizedName) {
      return NextResponse.json({ error: "SOW name is required" }, { status: 400 });
    }
    if (!inferSowPlatform(normalizedName)) {
      return NextResponse.json({ error: "SOW name must include a recognized platform: Instagram/IG, TikTok, YouTube, or Twitter/X" }, { status: 400 });
    }

    const data = await prisma.mst_sow.create({
      data: {
        sow_nama: normalizedName,
        sow_status: 1,
        creaby: session.user.name || "admin",
      },
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create SOW" }, { status: 500 });
  }
}
