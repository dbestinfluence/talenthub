import { prisma } from "@/lib/prisma"
import { defaultRole } from "@/lib/roles"
import bcrypt from "bcrypt"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const body = await req.json()

  const hashed = await bcrypt.hash(body.password, 10)

  const user = await prisma.user.create({
    data: {
      email: body.email,
      password: hashed,
      role: defaultRole
    }
  })

  return NextResponse.json(user)
}
