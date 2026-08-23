import { authOptions } from "@/auth"
import type { AppRole } from "@/lib/roles"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

export async function requireSession() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/login")
  }

  return session
}

export function hasRequiredRole(userRole: AppRole, allowedRoles: AppRole[]) {
  return allowedRoles.includes(userRole)
}

export function getDefaultRouteForRole(role: AppRole) {
  switch (role) {
    case "ADMIN":
      return "/"
    default:
      return "/"
  }
}

export async function requireRole(allowedRoles: AppRole[]) {
  const session = await requireSession()

  if (!hasRequiredRole(session.user.role, allowedRoles)) {
    redirect(`${getDefaultRouteForRole(session.user.role)}?unauthorized=1`)
  }

  return session
}
