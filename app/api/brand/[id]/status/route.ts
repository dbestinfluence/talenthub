import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    const { status } = await request.json();

    if (isNaN(id))
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const updated = await prisma.mst_brand.update({
      where: { brd_id: id },
      data: { brd_status: status },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
