import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { allowedRoles, defaultRole, type AppRole } from "@/lib/roles";
import bcrypt from "bcrypt";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        role: true,
      },
      orderBy: {
        email: "asc",
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to load users" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phoneNumber =
      typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role =
      typeof body.role === "string" ? body.role.toUpperCase() : defaultRole;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (!allowedRoles.includes(role as (typeof allowedRoles)[number])) {
      return NextResponse.json({ error: "Role tidak valid" }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phoneNumber: phoneNumber || null,
        password: hashed,
        role: role as AppRole,
        // Jika masih error, tambahkan baris ini untuk memanipulasi Prisma agar tidak mencari ID
        id: undefined as any,
      } as any, // <--- Ini akan mematikan pemeriksaan tipe TypeScript sementara
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        role: true,
      },
    });

    return NextResponse.json(user);
  } catch (error: any) {
    // Jika error karena email sudah terdaftar (Prisma code P2002)
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Email sudah terdaftar!" },
        { status: 400 }
      );
    }

    console.error("DEBUG ERROR:", error);
    return NextResponse.json(
      { error: "Failed to create user: " + error.message },
      { status: 500 }
    );
  }
}
