import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ id: string }> };
const idFrom = async (context: Context) => Number((await context.params).id);

export async function PUT(request: Request, context: Context) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const id = await idFrom(context);
    const body = await request.json();
    const name = String(body.bst_nama ?? "").trim();
    const address = String(body.bst_alamat ?? "").trim();
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid DBest ID" }, { status: 400 });
    if (!name || !address) return NextResponse.json({ error: "Name and address are required" }, { status: 400 });
    const data = await prisma.$transaction(async (tx) => {
      const current = await tx.mst_dbest.findUnique({ where: { bst_id: id } });
      if (!current) throw new Error("DBest data was not found");
      const usedByProjects = await tx.trs_project.count({ where: { prj_dbestid: id } });
      if (usedByProjects === 0) {
        return tx.mst_dbest.update({ where: { bst_id: id }, data: { bst_nama: name, bst_alamat: address, modiby: session.user.name || "admin", modidate: new Date() } });
      }

      // Preserve the identity used by existing projects and create a new version.
      await tx.mst_dbest.update({ where: { bst_id: id }, data: { bst_status: 2, modiby: session.user.name || "admin", modidate: new Date() } });
      if (current.bst_status === 1) {
        await tx.mst_dbest.updateMany({ where: { bst_status: 1 }, data: { bst_status: 2, modiby: session.user.name || "admin", modidate: new Date() } });
      }
      return tx.mst_dbest.create({ data: { bst_nama: name, bst_alamat: address, bst_status: current.bst_status === 1 ? 1 : 2, creaby: session.user.name || "admin" } });
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error("UPDATE DBEST ERROR:", error);
    return NextResponse.json({ error: "Failed to update DBest data" }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: Context) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const id = await idFrom(context);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid DBest ID" }, { status: 400 });
    await prisma.mst_dbest.update({ where: { bst_id: id }, data: { bst_status: 0, modiby: session.user.name || "admin", modidate: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE DBEST ERROR:", error);
    return NextResponse.json({ error: "Failed to delete DBest data" }, { status: 500 });
  }
}
