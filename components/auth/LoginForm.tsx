"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"

type LoginFormProps = {
  callbackUrl?: string
}

export default function LoginForm({ callbackUrl }: LoginFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const redirectTo = callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/"

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail || normalizedEmail.length > 254 || password.length > 128) {
      setError("Email atau password tidak valid")
      return
    }

    setLoading(true)
    setError("")

    const result = await signIn("credentials", {
      email: normalizedEmail,
      password,
      redirect: false
    })

    if (result?.error) {
      setError("Email atau password tidak valid")
      setLoading(false)
      return
    }

    window.location.href = redirectTo
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={254}
          autoComplete="email"
          className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white"
          required
        />
      </div>

      <div>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          maxLength={128}
          autoComplete="current-password"
          className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white"
          required
        />
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {loading ? "Signing in..." : "Login"}
      </button>
    </form>
  )
}