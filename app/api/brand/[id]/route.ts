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
    const approvers = [1, 2, 3, 4, 5].map((slot) => ({
      name: String(body[slot === 1 ? "brd_approver_name" : `brd_approver${slot}_name`] ?? "").trim(),
      title: String(body[slot === 1 ? "brd_approver_title" : `brd_approver${slot}_title`] ?? "").trim(),
    }));
    if (approvers.some((approver) => Boolean(approver.name) !== Boolean(approver.title))) {
      return NextResponse.json({ error: "Each approver must have both a name and title" }, { status: 400 });
    }
    if (!approvers.some((approver) => approver.name && approver.title)) {
      return NextResponse.json({ error: "At least one approver is required" }, { status: 400 });
    }

    const brand = await prisma.mst_brand.update({
      where: { brd_id: parseInt(id) },
      data: {
        brd_initial: body.brd_initial,
        brd_nama: body.brd_nama,
        brd_alamat: body.brd_alamat,
        brd_email: body.brd_email,
        brd_notelp: body.brd_notelp,
        brd_pic1: body.brd_pic1,
        brd_pic1_phone: body.brd_pic1_phone,
        brd_pic2: body.brd_pic2,
        brd_pic2_phone: body.brd_pic2_phone,
        brd_pic3: body.brd_pic3,
        brd_pic3_phone: body.brd_pic3_phone,
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
