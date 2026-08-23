import DefaultLayout from "@/components/Layout/DefaultLayout";
import TalentDashboard from "@/components/dashboard/TalentDashboard";
import { requireSession } from "@/lib/session";

export default async function Home() {
  await requireSession();
  return (
    <DefaultLayout>
      <TalentDashboard />
    </DefaultLayout>
  );
}
