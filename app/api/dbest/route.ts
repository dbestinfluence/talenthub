import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const data = await prisma.mst_dbest.findMany({
      where: { bst_status: { in: [1, 2] } },
      orderBy: { bst_id: "desc" },
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET DBEST ERROR:", error);
    return NextResponse.json({ error: "Failed to retrieve DBest data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const name = String(body.bst_nama ?? "").trim();
    const address = String(body.bst_alamat ?? "").trim();
    if (!name || !address) return NextResponse.json({ error: "Name and address are required" }, { status: 400 });
    const data = await prisma.$transaction(async (tx) => {
      await tx.mst_dbest.updateMany({ where: { bst_status: 1 }, data: { bst_status: 2, modiby: session.user.name || "admin", modidate: new Date() } });
      const created = await tx.mst_dbest.create({ data: { bst_nama: name, bst_alamat: address, bst_status: 1, creaby: session.user.name || "admin" } });
      await tx.trs_project.updateMany({ where: { prj_dbestid: null }, data: { prj_dbestid: created.bst_id } });
      return created;
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("CREATE DBEST ERROR:", error);
    return NextResponse.json({ error: "Failed to create DBest data" }, { status: 500 });
  }
}
