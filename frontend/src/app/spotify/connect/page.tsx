"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { startSpotifyAuthorization } from "@/lib/spotify-oauth";

export default function SpotifyConnectRedirectPage() {
  const started = useRef(false);
  const [message, setMessage] = useState("Đang chuyển đến trang cấp quyền Spotify…");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get("returnTo") ?? "/search";
    void startSpotifyAuthorization(returnTo).catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : "Không thể bắt đầu kết nối Spotify.");
    });
  }, []);

  return <section className="mx-auto max-w-xl rounded-2xl border border-ink-700 bg-ink-900 p-6"><h1 className="text-xl font-bold">Kết nối Spotify</h1><p role="status" className="mt-3 text-sm text-mist-300">{message}</p><Link href="/search" className="mt-5 inline-block text-sm text-lime-400 hover:underline">Quay lại tìm kiếm</Link></section>;
}
