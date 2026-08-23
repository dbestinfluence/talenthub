import type { Metadata } from "next";
import { authOptions } from "@/auth";
import AuthProvider from "@/components/providers/AuthProvider";
import { Analytics } from "@vercel/analytics/next";
import { getServerSession } from "next-auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "TalentHub Dashboard",
  description: "TalentHub dummy dashboard with collapsible sidebar",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider session={session}>{children}</AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
