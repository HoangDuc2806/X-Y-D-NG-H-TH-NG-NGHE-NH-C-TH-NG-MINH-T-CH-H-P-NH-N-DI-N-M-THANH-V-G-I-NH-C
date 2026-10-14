"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function TopBar() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (term) router.push(`/search?q=${encodeURIComponent(term)}`);
  }

  return (
    <header className="sticky top-0 z-10 border-b border-ink-700 bg-ink-950/90 px-4 py-3 backdrop-blur md:px-8">
      <form onSubmit={onSubmit} role="search" className="relative max-w-xl">
        <label htmlFor="global-search" className="sr-only">
          Tìm bài hát, nghệ sĩ hoặc album
        </label>
        <Search size={16} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-mist-300" />
        <input
          id="global-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm bài hát, nghệ sĩ hoặc album"
          className="w-full rounded-full border border-ink-700 bg-ink-800 py-2 pl-9 pr-4 text-sm placeholder:text-mist-300 focus:border-lime-500"
        />
      </form>
    </header>
  );
}
