import DefaultLayout from "@/components/Layout/DefaultLayout"
import UsersPageClient from "@/components/payment/PaymentPageClient"
import { requireRole } from "@/lib/session"

export default async function UsersPage() {
  await requireRole(["ADMIN"])

  return (
    <DefaultLayout>
      <UsersPageClient />
    </DefaultLayout>
  )
}
