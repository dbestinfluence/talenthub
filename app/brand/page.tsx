import DefaultLayout from "@/components/Layout/DefaultLayout"
import BrandPageClient from "@/components/brand/BrandPageClient" // Sesuaikan path folder Anda
import { requireRole } from "@/lib/session"

export default async function BrandPage() {
  await requireRole(["ADMIN"])

  return (
    <DefaultLayout>
      <BrandPageClient />
    </DefaultLayout>
  )
}