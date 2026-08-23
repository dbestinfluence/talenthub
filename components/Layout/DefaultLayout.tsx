"use client";

import { signOut, useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Sidebar from "../Sidebar/Sidebar";

type DefaultLayoutProps = {
  children: React.ReactNode;
};

export default function DefaultLayout({ children }: DefaultLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [accessToastVisible, setAccessToastVisible] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const accessToastShowTimeoutRef = useRef<number | null>(null);
  const accessToastHideTimeoutRef = useRef<number | null>(null);
  const { data: session } = useSession();
  const mounted = useMounted();
  const router = useRouter();
  const pathname = usePathname();
  const currentPage = pathname.includes("/tracking")
  ? {
      title: "Progress",
      description: "Monitor project campaign progress from draft to finish",
    }
  : pathname.includes("/discovery")
  ? {
      title: "Creator Discovery",
      description: "Discover the right creators for your campaigns",
    }
  : ["/users", "/payment", "/sow", "/brand", "/dbest"].some((path) => pathname.startsWith(path))
  ? {
      title: "Master Data",
      description: "Manage the reference data used throughout Talent Hub",
    }
  : {
      title: "Home",
      description: "Discover the right creators for your campaigns",
    };
  const searchParams = useSearchParams();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!profileRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (searchParams.get("unauthorized") === "1") {
      if (accessToastShowTimeoutRef.current) {
        window.clearTimeout(accessToastShowTimeoutRef.current);
      }

      if (accessToastHideTimeoutRef.current) {
        window.clearTimeout(accessToastHideTimeoutRef.current);
      }

      accessToastShowTimeoutRef.current = window.setTimeout(() => {
        setAccessToastVisible(true);
        accessToastShowTimeoutRef.current = null;
      }, 0);

      accessToastHideTimeoutRef.current = window.setTimeout(() => {
        setAccessToastVisible(false);
        accessToastHideTimeoutRef.current = null;
      }, 3000);

      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete("unauthorized");
      const nextQuery = nextParams.toString();

      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    }
  }, [pathname, router, searchParams]);

  useEffect(() => {
    return () => {
      if (accessToastShowTimeoutRef.current) {
        window.clearTimeout(accessToastShowTimeoutRef.current);
      }
      if (accessToastHideTimeoutRef.current) {
        window.clearTimeout(accessToastHideTimeoutRef.current);
      }
    };
  }, []);

  const profileName = mounted ? session?.user?.name || "Unknown User" : "Unknown User";
  const profileRole = mounted ? session?.user?.role || "-" : "-";
  const profileEmail = mounted ? session?.user?.email || "No email" : "No email";

  async function handleLogout() {
    setLoggingOut(true);
    setProfileOpen(false);
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#eff6ff_35%,_#f8fafc_100%)]">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
        onCloseMobile={() => setMobileOpen(false)}
      />

     <div className={`min-w-0 transition-[margin,width] duration-300 md:ml-20 md:w-[calc(100%-5rem)] ${mobileOpen ? "ml-20 w-[calc(100%-5rem)]" : "ml-0 w-full"}`}>
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 px-3 py-4 backdrop-blur sm:px-4 sm:py-5 md:px-8 md:py-7">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen((current) => !current)}
                className="shrink-0 rounded-lg border border-slate-300 bg-white p-2 text-slate-700 transition hover:bg-slate-50 md:hidden"
                aria-label={mobileOpen ? "Close sidebar" : "Open sidebar"}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">
                  {currentPage.title}
                </p>

                <p className="line-clamp-2 text-xs text-slate-500 sm:line-clamp-1">
                  {currentPage.description}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
            

              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setProfileOpen((prev) => !prev)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 shadow-sm transition hover:border-emerald-500 hover:text-emerald-600"
                  aria-label="Open profile card"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="8" r="3.5" />
                    <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
                  </svg>
                </button>

                {profileOpen && (
                  <div className="fixed inset-x-3 top-20 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.14)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-14 sm:w-72">
                    <div className="flex flex-col items-center text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500">
                        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <circle cx="12" cy="8" r="3.5" />
                          <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
                        </svg>
                      </div>
                      <p className="mt-4 text-lg font-semibold text-slate-900">
                        {profileName}
                      </p>
                      <p className="mt-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        {profileRole}
                      </p>
                      <p className="mt-3 break-all text-sm text-slate-600">
                        {profileEmail}
                      </p>
                      <button
                        type="button"
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loggingOut ? "Logging out..." : "Logout"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="min-w-0 px-3 py-4 sm:px-4 sm:py-6 md:px-8">{children}</main>

        {accessToastVisible ? (
          <div className="pointer-events-none fixed bottom-4 right-4 z-[70] max-w-sm rounded-2xl border border-rose-200 bg-rose-50/95 px-4 py-3 text-rose-700 shadow-[0_18px_50px_rgba(15,23,42,0.14)] backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 8v5" />
                  <path d="M12 16h.01" />
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                </svg>
              </div>
              <p className="text-sm font-semibold leading-none">You do not have permission to access this page.</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function useMounted() {
  return useSyncExternalStore(subscribeToMount, getClientSnapshot, getServerSnapshot);
}

function subscribeToMount() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}
