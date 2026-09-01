import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  defaultRole,
  isAppRole,
} from "@/lib/roles";
import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session =
      await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const users =
      await prisma.user.findMany({
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
    console.error(
      "Failed to load users:",
      error
    );

    return NextResponse.json(
      { error: "Failed to load users" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session =
      await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await req
      .json()
      .catch(() => null);

    const name =
      typeof body?.name === "string"
        ? body.name.trim()
        : "";

    const email =
      typeof body?.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const phoneNumber =
      typeof body?.phoneNumber === "string"
        ? body.phoneNumber.trim()
        : "";

    const password =
      typeof body?.password === "string"
        ? body.password
        : "";

    const requestedRole =
      typeof body?.role === "string"
        ? body.role.trim().toUpperCase()
        : defaultRole;

    if (!name || !email || !password) {
      return NextResponse.json(
        {
          error:
            "Name, email, and password are required",
        },
        { status: 400 }
      );
    }

    if (!isAppRole(requestedRole)) {
      return NextResponse.json(
        { error: "Role tidak valid" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          error:
            "Password minimal 8 karakter",
        },
        { status: 400 }
      );
    }

    const hashedPassword =
      await bcrypt.hash(password, 10);

    const user =
      await prisma.user.create({
        data: {
          name,
          email,
          phoneNumber:
            phoneNumber || null,
          password: hashedPassword,
          role: requestedRole,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          role: true,
        },
      });

    return NextResponse.json(
      user,
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Email sudah terdaftar!" },
        { status: 409 }
      );
    }

    console.error(
      "Failed to create user:",
      error
    );

    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}