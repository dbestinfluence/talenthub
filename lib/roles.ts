export const allowedRoles = ["ADMIN"] as const

export type AppRole = (typeof allowedRoles)[number]

export const defaultRole: AppRole = "ADMIN"
