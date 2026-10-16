/**
 * Quy tắc "một lượt nghe" cho lịch sử, tách khỏi React để có thể test.
 *
 * Một lượt nghe được ghi ĐÚNG MỘT LẦN khi trình phát Spotify báo bài hát thực sự đang phát
 * (không tạm dừng, không đang tải). Các sự kiện sau KHÔNG tạo lượt nghe mới:
 *   - tạm dừng / tiếp tục phát, cập nhật vị trí phát, chỉnh âm lượng, các sự kiện lặp.
 * Lượt nghe MỚI được tạo khi:
 *   - đổi sang bài khác;
 *   - bài hát kết thúc (SDK báo paused ở vị trí 0 sau khi đã chạy) rồi phát lại;
 *   - bài đang phát bị phát lại từ đầu sau khi đã nghe >= 10 giây ("Phát lại bài này").
 * Backend còn một lớp chống trùng (15 giây) cho trường hợp sự kiện bắn lặp hoặc nhiều tab.
 */
export const REPLAY_MIN_PROGRESS_MS = 10_000;
export const RESTART_POSITION_MS = 3_000;

export type ListenSession = {
  key: string | null;
  recorded: boolean;
  maxPosition: number;
};

export type PlayerSnapshot = {
  /** id bài hát Spotify (ưu tiên id gốc nếu bị relink); null nếu không phải bài hát Spotify. */
  key: string | null;
  paused: boolean;
  loading: boolean;
  position: number;
};

export const emptySession = (): ListenSession => ({ key: null, recorded: false, maxPosition: 0 });

export function nextListenStep(
  session: ListenSession,
  snapshot: PlayerSnapshot,
): { session: ListenSession; shouldRecord: boolean } {
  if (!snapshot.key) return { session: emptySession(), shouldRecord: false };

  let current: ListenSession =
    session.key === snapshot.key ? session : { key: snapshot.key, recorded: false, maxPosition: 0 };

  // Bài hát đã kết thúc: lần phát sau là lượt nghe mới.
  if (snapshot.paused && snapshot.position === 0 && current.maxPosition > 0) {
    return { session: { key: snapshot.key, recorded: false, maxPosition: 0 }, shouldRecord: false };
  }

  // Phát lại từ đầu sau khi đã nghe đủ lâu.
  if (
    current.recorded &&
    !snapshot.paused &&
    snapshot.position < RESTART_POSITION_MS &&
    current.maxPosition >= REPLAY_MIN_PROGRESS_MS
  ) {
    current = { key: snapshot.key, recorded: false, maxPosition: snapshot.position };
  }

  current = { ...current, maxPosition: Math.max(current.maxPosition, snapshot.position) };

  const reallyPlaying = !snapshot.paused && !snapshot.loading;
  if (reallyPlaying && !current.recorded) {
    return { session: { ...current, recorded: true }, shouldRecord: true };
  }
  return { session: current, shouldRecord: false };
}

/** Lấy id bài hát Spotify từ URI dạng spotify:track:<id>; null nếu là loại khác (podcast, local...). */
export function spotifyTrackIdFromUri(uri: string | null | undefined): string | null {
  const match = /^spotify:track:([A-Za-z0-9]+)$/.exec(uri ?? "");
  return match?.[1] ?? null;
}
