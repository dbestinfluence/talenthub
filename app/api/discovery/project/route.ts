import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { isGoogleSheetsConfigured, syncProjectSpreadsheet } from "@/lib/google-sheets";
import { createTransactionNumber } from "@/lib/project-numbers";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    // 1. Ambil session user yang sedang login
    const session = await getServerSession(authOptions);
    const usernameLogin = session?.user?.name || session?.user?.email || "SYSTEM";

    const body = await request.json();
    const { projectName, brandId, projectPic, quotationPic, startDate, endDate, selectedCreators } = body;

    // 2. Validasi input dasar
    if (
      !projectName ||
      !brandId ||
      !projectPic ||
      !quotationPic ||
      !startDate ||
      !endDate ||
      !selectedCreators ||
      selectedCreators.length === 0
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);

    if (
      Number.isNaN(parsedStartDate.getTime()) ||
      Number.isNaN(parsedEndDate.getTime())
    ) {
      return NextResponse.json(
        { error: "Start Date and End Date must be valid dates." },
        { status: 400 }
      );
    }

    if (parsedEndDate < parsedStartDate) {
      return NextResponse.json(
        { error: "End Date cannot be earlier than Start Date." },
        { status: 400 }
      );
    }

    // 4. Jalankan Prisma Transaction
    const result = await prisma.$transaction(async (tx) => {
      const brand = await tx.mst_brand.findFirst({
        where: { brd_id: parseInt(brandId), brd_status: 1 },
        select: {
          brd_pic1: true, brd_pic1_phone: true,
          brd_pic2: true, brd_pic2_phone: true,
          brd_pic3: true, brd_pic3_phone: true,
        },
      });
      if (!brand) throw new Error("The selected brand is unavailable.");
      const brandPics = [
        { name: brand.brd_pic1?.trim(), phone: brand.brd_pic1_phone?.trim() },
        { name: brand.brd_pic2?.trim(), phone: brand.brd_pic2_phone?.trim() },
        { name: brand.brd_pic3?.trim(), phone: brand.brd_pic3_phone?.trim() },
      ].filter((pic): pic is { name: string; phone: string | undefined } => Boolean(pic.name));
      const selectedProjectPic = brandPics.find((pic) => pic.name === projectPic);
      const selectedQuotationPic = brandPics.find((pic) => pic.name === quotationPic);
      if (!selectedProjectPic || !selectedQuotationPic) {
        throw new Error("Project PIC and Quotation PIC must be selected from the brand contacts.");
      }
      const activeDbest = await tx.mst_dbest.findFirst({
        where: { bst_status: 1 },
        orderBy: { bst_id: "desc" },
        select: { bst_id: true },
      });
      if (!activeDbest) {
        throw new Error("Configure an active DBest identity in Master Data before creating a project.");
      }
      // Langkah A: Insert ke tabel trs_project
      const prjKode = createTransactionNumber();

      const newProject = await tx.trs_project.create({
        data: {
          prj_kode: prjKode,
          prj_brand: parseInt(brandId),
          prj_dbestid: activeDbest.bst_id,
          prj_nama: projectName,
          prj_project_pic: selectedProjectPic.name,
          prj_quotation_pic: selectedQuotationPic.name,
          prj_quotation_phone: selectedQuotationPic.phone ?? null,
          prj_dstartdate: parsedStartDate,
          prj_denddate: parsedEndDate,
          prj_status: 1,
          creaby: usernameLogin,
          creadate: new Date(),
        },
      });

      // Langkah B: Siapkan list data untuk tabel dtl_project
      const detailData = selectedCreators.map((creator: any) => {
        // FIX: field ID asli dari GET /api/discovery bernama "no", bukan "id"
        const creatorDatabaseId = creator.no;

        if (!creatorDatabaseId) {
          throw new Error(
            `Creator ${creator.name || ""} tidak memiliki ID database yang valid.`
          );
        }

        return {
          drf_projectid: newProject.prj_id,
          drf_creatorid: parseInt(creatorDatabaseId),
          drf_platform: creator.social_media ?? creator.platform ?? null,
          drf_sow: null,
          drf_qty: null,
          drf_rate: null,
          drf_markup_price: null,
          drf_status: 0,
          creaby: usernameLogin,
          creadate: new Date(),
        };
      });

      // Langkah C: Bulk insert ke tabel dtl_project
      await tx.dtl_project.createMany({
        data: detailData,
      });

      return newProject;
    });

    if (isGoogleSheetsConfigured()) {
      await syncProjectSpreadsheet(result.prj_id).catch((error) =>
        console.error("AUTO CREATE GOOGLE SHEET ERROR:", error)
      );
    }

    return NextResponse.json({ success: true, project: result });
  } catch (error) {
    console.error("Failed to save project and details:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
