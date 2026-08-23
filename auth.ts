import { PrismaAdapter } from "@auth/prisma-adapter"
import type { Adapter } from "next-auth/adapters"
import type { NextAuthOptions } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import type { AppRole } from "@/lib/roles"
import bcrypt from "bcrypt"

const MAX_EMAIL_LENGTH = 254
const MAX_PASSWORD_LENGTH = 128
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Used only to keep invalid-user and invalid-password checks on a similar code path.
const DUMMY_PASSWORD_HASH = "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi."

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,

  adapter: PrismaAdapter(prisma) as Adapter,

  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {}
      },

      async authorize(credentials) {
        const email = typeof credentials?.email === "string"
          ? credentials.email.trim().toLowerCase()
          : ""
        const password = typeof credentials?.password === "string"
          ? credentials.password
          : ""

        if (
          !email ||
          !password ||
          email.length > MAX_EMAIL_LENGTH ||
          password.length > MAX_PASSWORD_LENGTH ||
          !EMAIL_PATTERN.test(email)
        ) {
          return null
        }

        // Prisma parameterizes this filter; credentials never become raw SQL.
        const user = await prisma.user.findFirst({
          where: {
            email: {
              equals: email,
              mode: "insensitive"
            }
          }
        })

        const valid = await bcrypt.compare(
          password,
          user?.password ?? DUMMY_PASSWORD_HASH
        )

        if (!user || !valid) return null

        return user
      }
    })
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.name = user.name
        token.email = user.email
        token.role = user.role
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.name = token.name
        session.user.email = token.email as string
        session.user.role = token.role as AppRole
      }
      return session
    }
  },

  session: {
    strategy: "jwt"
  }
}
