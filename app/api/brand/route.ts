import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const brands = await prisma.mst_brand.findMany({
      where: { brd_status: { in: [1, 2] } },
      orderBy: { brd_id: "desc" },
    });

    return NextResponse.json(brands);
  } catch (error) {
    console.error("GET BRAND ERROR:", error);
    return NextResponse.json({ error: "Failed to load brands" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { brd_initial, brd_nama, brd_alamat, brd_email, brd_notelp, brd_pic1, brd_pic1_phone, brd_pic2, brd_pic2_phone, brd_pic3, brd_pic3_phone } = body;
    const approvers = [1, 2, 3, 4, 5].map((slot) => ({
      name: String(body[slot === 1 ? "brd_approver_name" : `brd_approver${slot}_name`] ?? "").trim(),
      title: String(body[slot === 1 ? "brd_approver_title" : `brd_approver${slot}_title`] ?? "").trim(),
    }));

    if (!brd_nama) return NextResponse.json({ error: "Brand name is required" }, { status: 400 });
    if (approvers.some((approver) => !approver.name && Boolean(approver.title))) {
      return NextResponse.json({ error: "An approver title requires an approver name" }, { status: 400 });
    }
    if (!approvers.some((approver) => approver.name)) {
      return NextResponse.json({ error: "At least one approver is required" }, { status: 400 });
    }

    const brand = await prisma.mst_brand.create({
      data: {
        brd_initial,
        brd_nama,
        brd_alamat,
        brd_email,
        brd_notelp,
        brd_pic1,
        brd_pic1_phone,
        brd_pic2,
        brd_pic2_phone,
        brd_pic3,
        brd_pic3_phone,
        brd_approver_name: approvers[0].name || null,
        brd_approver_title: approvers[0].title || null,
        brd_approver2_name: approvers[1].name || null,
        brd_approver2_title: approvers[1].title || null,
        brd_approver3_name: approvers[2].name || null,
        brd_approver3_title: approvers[2].title || null,
        brd_approver4_name: approvers[3].name || null,
        brd_approver4_title: approvers[3].title || null,
        brd_approver5_name: approvers[4].name || null,
        brd_approver5_title: approvers[4].title || null,
        brd_status: 1,
        creaby: session.user.name || "admin",
      },
    });

    return NextResponse.json(brand, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create brand" }, { status: 500 });
  }
}
