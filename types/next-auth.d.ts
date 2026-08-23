import "next-auth"
import "next-auth/jwt"
import type { AppRole } from "@/lib/roles"

declare module "next-auth" {
  interface User {
    id: string
    name?: string | null
    email: string
    role: AppRole
  }

  interface Session {
    user: {
      id: string
      name?: string | null
      email: string
      role: AppRole
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    name?: string | null
    email?: string
    role?: AppRole
  }
}
