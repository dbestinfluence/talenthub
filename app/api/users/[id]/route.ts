import { authOptions } from "@/auth"
import { prisma } from "@/lib/prisma"
import { allowedRoles, defaultRole, type AppRole } from "@/lib/roles"
import bcrypt from "bcrypt"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function PUT(req: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await context.params
    const body = await req.json()
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const phoneNumber = typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : ""
    const password = typeof body.password === "string" ? body.password : ""
    const role = typeof body.role === "string" ? body.role.toUpperCase() : defaultRole

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      )
    }

    if (!allowedRoles.includes(role as (typeof allowedRoles)[number])) {
      return NextResponse.json(
        { error: "Role tidak valid" },
        { status: 400 }
      )
    }

    const data: {
      name: string
      email: string
      phoneNumber: string | null
      role: AppRole
      password?: string
    } = {
      name,
      email,
      phoneNumber: phoneNumber || null,
      role: role as AppRole
    }

    if (password) {
      data.password = await bcrypt.hash(password, 10)
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        role: true
      }
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    )
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await context.params

    await prisma.user.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    )
  }
}
