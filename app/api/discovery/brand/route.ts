import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Mengambil data brand yang aktif dari database
    const brands = await prisma.mst_brand.findMany({
      where: { brd_status: 1 },
      select: { brd_id: true, brd_nama: true },
      orderBy: { brd_nama: "asc" },
    });

    // Konversi ID ke string agar konsisten saat di-render di select/dropdown front-end
    const formattedBrands = brands.map((b) => ({
      id: b.brd_id.toString(),
      name: b.brd_nama,
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