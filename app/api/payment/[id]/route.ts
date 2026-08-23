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

    const payment = await prisma.mst_payment.update({
      where: { pyt_id: parseInt(id) },
      data: {
        pyt_bank: body.pyt_bank,
        pyt_norek: body.pyt_norek,
        pyt_nama: body.pyt_nama,
        modiby: session.user.name || "admin",
        modidate: new Date(),
      },
    });

    return NextResponse.json(payment);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update payment account" },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    await prisma.mst_payment.update({
      where: {
        pyt_id: parseInt(id),
      },
      data: {
        pyt_status: 0,
        modiby: session.user.name || "admin",
        modidate: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Payment account deactivated successfully",
    });
  } catch (error) {
    console.error("DELETE PAYMENT ERROR:", error);

    return NextResponse.json(
      { error: "Failed to delete payment account" },
      { status: 500 }
    );
  }
}

