import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payments = await prisma.mst_payment.findMany({
      where: {
        pyt_status: {
          in: [1, 2], // statusnya 1 ATAU 2
        },
      },
      orderBy: {
        pyt_id: "desc",
      },
    });

    return NextResponse.json(payments);
  } catch (error) {
    console.error("GET PAYMENT ERROR:", error);

    return NextResponse.json(
      { error: "Failed to load payment accounts" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { pyt_bank, pyt_norek, pyt_nama } = body;

    if (!pyt_bank || !pyt_norek || !pyt_nama) {
      return NextResponse.json({ error: "All payment fields are required" }, { status: 400 });
    }

    const payment = await prisma.mst_payment.create({
      data: {
        pyt_bank,
        pyt_norek,
        pyt_nama,
        pyt_status: 1, // Otomatis 1 sesuai permintaan
        creaby: session.user.name || "admin",
      },
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create payment account" },
      { status: 500 }
    );
  }
}
