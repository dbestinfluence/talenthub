"use client";

import type { AppRole } from "@/lib/roles";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore, useEffect, useRef } from "react";
import Image from "next/image";

type SidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
};

type MenuItem = {
  label: string;
  href: string; // href jadi opsional
  icon: React.ReactNode;
  roles?: AppRole[];
  subItems?: { label: string; href: string }[];
};

const menuItems: MenuItem[] = [
  {
    label: "Home",
    href: "/",
    icon: (
      <svg
        className="fill-current"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M3 10L12 3L21 10V20C21 20.55 20.55 21 20 21H15C14.45 21 14 20.55 14 20V16C14 15.45 13.55 15 13 15H11C10.45 15 10 15.45 10 16V20C10 20.55 9.55 21 9 21H4C3.45 21 3 20.55 3 20V10Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  // {
  //   label: "Analysis",
  //   href: "/analysis",
  //   icon: (
  //     <svg
  //       viewBox="0 0 24 24"
  //       className="h-5 w-5"
  //       fill="none"
  //       stroke="currentColor"
  //       strokeWidth="1.8"
  //     >
  //       <path d="M4 20h16" />
  //       <path d="M7 16v-4M12 16V8M17 16v-6" />
  //     </svg>
  //   ),
  // },
  // {
  //   label: "Planning",
  //   href: "/planning",
  //   roles: ["ADMIN", "ORDERING"],
  //   icon: (
  //     <svg
  //       viewBox="0 0 24 24"
  //       className="h-5 w-5"
  //       fill="none"
  //       stroke="currentColor"
  //       strokeWidth="1.8"
  //     >
  //       <path d="M4 6h16v14H4z" />
  //       <path d="M8 3v6M16 3v6" />
  //       <path d="M4 10h16" />
  //       <path d="M8 14h3M8 18h8" />
  //     </svg>
  //   ),
  // },
  // {
  //   label: "Ordering",
  //   href: "/ordering",
  //   roles: ["ADMIN", "ORDERING"],
  //   icon: (
  //     <svg
  //       viewBox="0 0 24 24"
  //       className="h-5 w-5"
  //       fill="none"
  //       stroke="currentColor"
  //       strokeWidth="1.8"
  //     >
  //       <path d="M4 7.5h16" />
  //       <path d="M7 4.5v6" />
  //       <path d="M17 4.5v6" />
  //       <rect x="4" y="6" width="16" height="14" rx="2" />
  //       <path d="M8 12h8M8 16h5" />
  //     </svg>
  //   ),
  // },
  // {
  //   label: "Stock",
  //   href: "/ordering/stock",
  //   roles: ["ADMIN", "ORDERING"],
  //   icon: (
  //     <svg
  //       viewBox="0 0 24 24"
  //       className="h-5 w-5"
  //       fill="none"
  //       stroke="currentColor"
  //       strokeWidth="1.8"
  //     >
  //       <path d="M4 7.5 12 3l8 4.5-8 4.5L4 7.5Z" />
  //       <path d="M4 7.5v9L12 21l8-4.5v-9" />
  //       <path d="M12 12v9" />
  //     </svg>
  //   ),
  // },

  {
    label: "Creator\nDiscovery",
    href: "/discovery",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <circle cx="12" cy="10" r="3" />
        <path d="M14.5 12.5L16 14" />
      </svg>
    ),
  },

  {
    label: "Progress",
    href: "/tracking",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },

  // {
  //   label: "Influencer",
  //   href: "/influencer",
  //   roles: ["ADMIN"],
  //   icon: (
  //     <svg
  //       viewBox="0 0 24 24"
  //       className="h-5 w-5"
  //       fill="none"
  //       stroke="currentColor"
  //       strokeWidth="1.8"
  //     >
  //       <path d="M16 19a4 4 0 0 0-8 0" />
  //       <circle cx="12" cy="9" r="3" />
  //       <path d="M19 19a3 3 0 0 0-2.2-2.88" />
  //       <path d="M17 7.5a2.5 2.5 0 0 1 0 5" />
  //     </svg>
  //   ),
  // },

  {
    label: "Master Data",
    href: "/master",
    roles: ["ADMIN"],
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
    subItems: [
      { label: "User Management", href: "/users" },
      { label: "Payment Accounts", href: "/payment" },
      { label: "SOW Management", href: "/sow" },
      { label: "Brand Management", href: "/brand" },
      { label: "Company Profile", href: "/dbest" },
    ],
  },
];

export default function Sidebar({
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile,
}: SidebarProps) {
  const mounted = useMounted();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [openSubMenu, setOpenSubMenu] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpenSubMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const userRole = mounted
    ? (session?.user?.role as AppRole | undefined)
    : undefined;
  const visibleMenuItems = menuItems.filter(
    (item) => !item.roles || (userRole && item.roles.includes(userRole))
  );

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-20 border-r border-slate-100 bg-white text-slate-600 shadow-lg transition-transform duration-300 md:z-40 md:translate-x-0 md:shadow-none ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col items-center">
          <div className="flex items-center justify-center py-6">
  <Image
    src="/images/branding/dbest-logo-transparent.png"
    alt="D'Best Influence"
    width={64}
    height={32}
    className="h-8 w-16 object-contain"
  />
</div>

          <nav className="flex-1 w-full flex flex-col items-center gap-1 px-2">
            {visibleMenuItems.map((item) => {
              // Cek apakah halaman sekarang adalah halaman aktif dari sub-menu
              const isSubActive = item.subItems?.some((sub) =>
                pathname.startsWith(sub.href)
              );

              // Menu aktif jika pathname sama dengan href, ATAU jika salah satu sub-menu aktif
              const isActive = pathname === item.href || isSubActive;

              if (item.subItems) {
                return (
                  <div
                    key={item.label}
                    ref={containerRef}
                    className="relative w-full flex justify-center"
                  >
                    <button
                      onClick={() =>
                        setOpenSubMenu(
                          openSubMenu === item.label ? null : item.label
                        )
                      }
                      // Gunakan logika isActive untuk warna latar belakang button
                      className={`group flex w-16 flex-col items-center justify-center gap-1 rounded-xl py-3 transition ${
                        isActive ? "bg-[#FFEED2]" : "hover:bg-[#FFEED2]"
                      }`}
                    >
                      {/* Gunakan logika isActive untuk warna icon */}
                      <span
                        className={`transition-colors ${
                          isActive
                            ? "text-[#F4AC39]"
                            : "text-[#90A1B9] group-hover:text-[#F4AC39]"
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span className="text-[10px] text-black font-medium">
                        {item.label}
                      </span>
                    </button>

                    {openSubMenu === item.label && (
                      <div className="absolute left-16 ml-2 w-40 rounded-xl bg-white border border-slate-100 shadow-xl py-2 z-50">
                        {item.subItems.map((sub) => {
                          const isSubItemActive = pathname === sub.href;
                          return (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              onClick={() => { setOpenSubMenu(null); onCloseMobile(); }}
                              className={`block px-4 py-2 text-xs transition ${
                                isSubItemActive
                                  ? "text-[#F4AC39] font-bold bg-slate-50"
                                  : "text-slate-600 hover:text-black hover:bg-slate-50"
                              }`}
                            >
                              {sub.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onCloseMobile}
                  className={`group flex w-16 flex-col items-center justify-center gap-1 rounded-xl py-3 transition 
          ${isActive ? "bg-[#FFEED2]" : "hover:bg-[#FFEED2]"}`} // Warna latar aktif/hover
                >
                  <span
                    className={`transition-colors ${
                      isActive
                        ? "text-[#F4AC39]" // Warna Ikon saat Active
                        : "text-[#90A1B9] group-hover:text-[#F4AC39]" // Warna Ikon saat normal & hover
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span
                    className={`text-[10px] font-medium leading-[1.1] mt-0.5 w-full text-center block ${
                      isActive ? "text-black" : "text-black"
                    }`}
                  >
                    {item.label.split("\n").map((line, i) => (
                      <span key={i} className="block">
                        {line}
                      </span>
                    ))}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 text-[10px] text-slate-400">v1.0</div>
        </div>
      </aside>

    </>
  );
}

function useMounted() {
  return useSyncExternalStore(
    subscribeToMount,
    getClientSnapshot,
    getServerSnapshot
  );
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
