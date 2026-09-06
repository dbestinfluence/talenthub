import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Mengambil data brand yang aktif dari database
    const brands = await prisma.mst_brand.findMany({
      where: { brd_status: 1 },
      select: {
        brd_id: true,
        brd_nama: true,
        brd_pic1: true,
        brd_pic1_phone: true,
        brd_pic2: true,
        brd_pic2_phone: true,
        brd_pic3: true,
        brd_pic3_phone: true,
      },
      orderBy: { brd_nama: "asc" },
    });

    // Konversi ID ke string agar konsisten saat di-render di select/dropdown front-end
    const formattedBrands = brands.map((b) => ({
      id: b.brd_id.toString(),
      name: b.brd_nama,
      pics: [
        { name: b.brd_pic1, phone: b.brd_pic1_phone },
        { name: b.brd_pic2, phone: b.brd_pic2_phone },
        { name: b.brd_pic3, phone: b.brd_pic3_phone },
      ].filter((pic) => pic.name?.trim()),
    }));

    return NextResponse.json(formattedBrands);
  } catch (error) {
    console.error("Failed to fetch brand data from discovery endpoint:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
