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
    const { brd_initial, brd_nama, brd_alamat, brd_email, brd_notelp, brd_pic1, brd_pic2, brd_pic3 } = body;

    if (!brd_nama) return NextResponse.json({ error: "Brand name is required" }, { status: 400 });

    const brand = await prisma.mst_brand.create({
      data: {
        brd_initial,
        brd_nama,
        brd_alamat,
        brd_email,
        brd_notelp,
        brd_pic1,
        brd_pic2,
        brd_pic3,
        brd_status: 1,
        creaby: session.user.name || "admin",
      },
    });

    return NextResponse.json(brand, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create brand" }, { status: 500 });
  }
}
