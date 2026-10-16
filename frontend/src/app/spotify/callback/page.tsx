"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { completeSpotifyAuthorization } from "@/lib/spotify-oauth";

export default function SpotifyCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Đang hoàn tất kết nối tài khoản Spotify…");
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void completeSpotifyAuthorization(window.location.search)
      .then((returnTo) => {
        setMessage("Đã kết nối Spotify. Đang mở lại Music Discovery Vietnam…");
        window.history.replaceState({}, document.title, "/spotify/callback");
        router.replace(returnTo);
      })
      .catch((error: unknown) => {
        setFailed(true);
        setMessage(error instanceof Error ? error.message : "Không thể kết nối Spotify.");
      });
  }, [router]);

  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-ink-700 bg-ink-900 p-6 sm:p-8">
      <h1 className="text-2xl font-bold">Kết nối Spotify</h1>
      <p role={failed ? "alert" : "status"} className={`mt-3 text-sm leading-relaxed ${failed ? "text-red-300" : "text-mist-300"}`}>{message}</p>
      {failed && <div className="mt-5 flex flex-wrap gap-3"><Link href="/search" className="rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-ink-950">Về tìm kiếm nhạc</Link><Link href="/" className="rounded-xl border border-ink-600 px-4 py-2 text-sm">Trang chủ</Link></div>}
    </section>
  );
}
