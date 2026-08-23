import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: Request, context: RouteContext) {
  
}

