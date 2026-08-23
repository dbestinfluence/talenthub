import DefaultLayout from "@/components/Layout/DefaultLayout";
import DbestPageClient from "@/components/dbest/DbestPageClient";
import { requireRole } from "@/lib/session";

export default async function DbestPage() {
  await requireRole(["ADMIN"]);
  return <DefaultLayout><DbestPageClient /></DefaultLayout>;
}
