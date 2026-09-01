export const allowedRoles = [
  "ADMIN",
  "EMPLOYEE",
] as const;

export type AppRole =
  (typeof allowedRoles)[number];

export const defaultRole: AppRole =
  "EMPLOYEE";

export function isAppRole(
  value: unknown
): value is AppRole {
  return (
    typeof value === "string" &&
    allowedRoles.includes(value as AppRole)
  );
}