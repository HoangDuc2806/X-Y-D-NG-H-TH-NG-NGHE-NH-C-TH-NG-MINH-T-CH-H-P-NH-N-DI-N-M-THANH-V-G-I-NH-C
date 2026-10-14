"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r border-ink-700 bg-ink-900 p-4 md:flex">
      <div className="px-2 pt-2">
        <p className="text-lg font-bold leading-tight text-lime-400">Music Discovery</p>
        <p className="text-sm text-mist-300">Việt Nam</p>
      </div>
      <nav aria-label="Điều hướng chính" className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active ? "bg-ink-700 text-lime-400" : "text-mist-300 hover:bg-ink-800 hover:text-mist-100"
              }`}
            >
              <Icon size={18} aria-hidden /> {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-16 z-20 flex justify-around border-t border-ink-700 bg-ink-900 md:hidden"
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
              active ? "text-lime-400" : "text-mist-300"
            }`}
          >
            <Icon size={20} aria-hidden /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
