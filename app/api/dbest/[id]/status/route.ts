import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const id = Number((await params).id);
    const status = Number((await request.json()).status);
    if (!Number.isInteger(id) || ![1, 2].includes(status)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const data = await prisma.$transaction(async (tx) => {
      if (status === 1) await tx.mst_dbest.updateMany({ where: { bst_status: 1, NOT: { bst_id: id } }, data: { bst_status: 2, modiby: session.user.name || "admin", modidate: new Date() } });
      return tx.mst_dbest.update({ where: { bst_id: id }, data: { bst_status: status, modiby: session.user.name || "admin", modidate: new Date() } });
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error("STATUS DBEST ERROR:", error);
    return NextResponse.json({ error: "Failed to update DBest status" }, { status: 500 });
  }
}
