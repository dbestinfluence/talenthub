import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params; // <-- await di sini
  const projectId = Number(id);
  if (isNaN(projectId)) {
    return NextResponse.json({ error: "Invalid Project ID" }, { status: 400 });
  }

  
  try {
    const body = await req.json();
    const { selectedCreators } = body;

    if (
      !selectedCreators ||
      !Array.isArray(selectedCreators) ||
      selectedCreators.length === 0
    ) {
      return NextResponse.json(
        { error: "No creators selected" },
        { status: 400 }
      );
    }

    // 1. Pastikan project memang ada
    const project = await prisma.trs_project.findUnique({
      where: { prj_id: projectId },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const usernameLogin = session.user.name || session.user.email || "SYSTEM";

    // 3. Cegah duplikat: ambil creator yang SUDAH ada di project ini
    const existingDetails = await prisma.dtl_project.findMany({
      where: { drf_projectid: projectId },
      select: { drf_creatorid: true },
    });
    const existingCreatorIds = new Set(
      existingDetails.map((d) => d.drf_creatorid)
    );

    // 4. Filter hanya creator yang benar-benar baru
    const newCreators = selectedCreators.filter(
      (creator: any) => !existingCreatorIds.has(Number(creator.no))
    );

    if (newCreators.length === 0) {
      return NextResponse.json(
        { error: "All selected creators are already in this project." },
        { status: 400 }
      );
    }

    // 5. Siapkan data untuk insert
    const detailData = newCreators.map((creator: any) => {
      const creatorDatabaseId = creator.no; // field "no" berisi ID asli dari mst_creators

      if (!creatorDatabaseId) {
        throw new Error(
          `Creator ${creator.name || ""} tidak memiliki ID database yang valid.`
        );
      }

      return {
        drf_projectid: projectId,
        drf_creatorid: parseInt(creatorDatabaseId),
        drf_sow: null,
        drf_qty: null,
        drf_rate: null,
        drf_markup_price: null,
        drf_status: 0,
        creaby: usernameLogin,
        creadate: new Date(),
      };
    });

    // 6. Insert creator baru

    await prisma.dtl_project.createMany({ data: detailData });

    // 7. Update jejak modifikasi di project induk
    await prisma.trs_project.update({
      where: { prj_id: projectId },
      data: { modiby: usernameLogin, modidate: new Date() },
    });

    return NextResponse.json({
      success: true,
      added: detailData.length,
    });
  } catch (error) {
    console.error("Failed to update project creators:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
