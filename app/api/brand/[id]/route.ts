import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const body = await req.json();

    const brand = await prisma.mst_brand.update({
      where: { brd_id: parseInt(id) },
      data: {
        brd_initial: body.brd_initial,
        brd_nama: body.brd_nama,
        brd_alamat: body.brd_alamat,
        brd_email: body.brd_email,
        brd_notelp: body.brd_notelp,
        brd_pic1: body.brd_pic1,
        brd_pic2: body.brd_pic2,
        brd_pic3: body.brd_pic3,
        modiby: session.user.name || "admin",
        modidate: new Date(),
      },
    });

    return NextResponse.json(brand);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update brand" }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    await prisma.mst_brand.update({
      where: { brd_id: parseInt(id) },
      data: {
        brd_status: 0,
        modiby: session.user.name || "admin",
        modidate: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Brand deactivated successfully",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete brand" },
      { status: 500 }
    );
  }
}
