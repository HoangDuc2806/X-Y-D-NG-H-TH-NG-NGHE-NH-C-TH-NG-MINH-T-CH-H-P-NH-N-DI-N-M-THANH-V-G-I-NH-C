import { Music2, Pause, Play, SkipBack, SkipForward, Volume2 } from "lucide-react";

/** Khung thanh phát nhạc. Chỉ dành cho kho nhạc được cấp phép (Giai đoạn 3). */
export function PlayerBar() {
  const btn = "rounded-full p-2 text-mist-300 disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div
      role="region"
      aria-label="Trình phát nhạc"
      className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center gap-4 border-t border-ink-700 bg-ink-900 px-4"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded bg-ink-700 text-mist-300">
          <Music2 size={18} aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm">Chưa có bài hát nào</p>
          <p className="truncate text-xs text-mist-300">Chọn bài từ kho nhạc được cấp phép để phát</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button className={btn} disabled aria-label="Bài trước"><SkipBack size={18} /></button>
        <button className={`${btn} bg-mist-100 text-ink-950`} disabled aria-label="Phát"><Play size={18} /></button>
        <button className={btn} disabled aria-label="Tạm dừng"><Pause size={18} /></button>
        <button className={btn} disabled aria-label="Bài tiếp theo"><SkipForward size={18} /></button>
      </div>
      <div className="hidden flex-1 items-center justify-end gap-2 text-mist-300 md:flex">
        <Volume2 size={16} aria-hidden />
        <div className="h-1 w-24 rounded bg-ink-700" />
      </div>
    </div>
  );
}
