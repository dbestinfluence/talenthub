import LoginForm from "@/components/auth/LoginForm";
import { authOptions } from "@/auth";
import { getServerSession } from "next-auth";
import Image from "next/image";
import { redirect } from "next/navigation";

type LoginPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getServerSession(authOptions);
  const params = await searchParams;
  const callbackUrl = Array.isArray(params?.callbackUrl)
    ? params?.callbackUrl[0]
    : params?.callbackUrl;

  if (session?.user) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-white to-[#FFD7A2] px-4 py-10">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-xl md:grid-cols-2">
        <section className="hidden min-h-[560px] items-center justify-center bg-[#F0B562] p-10 md:flex">
          <Image
            src="/image/login.png"
            alt="TalentHub"
            width={320}
            height={320}
            className="h-auto w-full max-w-[280px] object-contain"
            priority
          />
        </section>

        <section className="flex flex-col justify-center px-8 py-12 sm:px-12">
          <h1
            className="text-center text-4xl font-black tracking-tight text-slate-900"
            style={{ WebkitTextStroke: "0.5px currentColor" }}
          >
            TALENT HUB
          </h1>
          <p className="mb-8 mt-2 text-center text-sm text-slate-500">
            Start analyzing talent and campaigns with confidence
          </p>

          <LoginForm callbackUrl={callbackUrl} />
        </section>
      </div>
    </main>
  );
}
