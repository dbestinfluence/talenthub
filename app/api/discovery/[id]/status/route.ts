import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // Params sekarang adalah Promise
) {
  try {
    // 1. Await params terlebih dahulu
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    const { status } = await request.json();

    if (isNaN(id)) {
      return NextResponse.json({ error: `Invalid ID: ${resolvedParams.id}` }, { status: 400 });
    }

    const updated = await prisma.mst_payment.update({
      where: { pyt_id: id },
      data: { pyt_status: status },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("API DEBUG:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}