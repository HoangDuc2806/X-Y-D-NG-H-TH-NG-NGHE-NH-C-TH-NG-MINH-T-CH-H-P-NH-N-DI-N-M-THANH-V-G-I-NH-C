"use client";

import { useEffect, useState } from "react";
import { getHealth, ApiError } from "@/lib/api";

type State = { kind: "loading" } | { kind: "ok" } | { kind: "error"; message: string };

export function BackendStatus() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const ctrl = new AbortController();
    getHealth(ctrl.signal)
      .then(() => setState({ kind: "ok" }))
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setState({ kind: "error", message: e instanceof ApiError ? e.message : "Lỗi không xác định." });
      });
    return () => ctrl.abort();
  }, []);

  const dot =
    state.kind === "ok" ? "bg-lime-400" : state.kind === "loading" ? "bg-mist-300" : "bg-red-400";
  const text =
    state.kind === "ok"
      ? "Máy chủ đang hoạt động"
      : state.kind === "loading"
        ? "Đang kiểm tra máy chủ…"
        : `${state.message} Hãy chạy backend ở cổng 8000.`;

  return (
    <p role="status" className="inline-flex items-center gap-2 rounded-full bg-ink-800 px-3 py-1 text-sm">
      <span className={`size-2 rounded-full ${dot}`} aria-hidden /> {text}
    </p>
  );
}
