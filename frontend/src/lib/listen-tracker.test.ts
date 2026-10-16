import { describe, expect, it } from "vitest";
import {
  emptySession,
  nextListenStep,
  spotifyTrackIdFromUri,
  type ListenSession,
  type PlayerSnapshot,
} from "./listen-tracker";

type Event = Partial<PlayerSnapshot> & { key?: string | null };

/** Chạy chuỗi sự kiện trình phát, trả về danh sách track_id đã được ghi lịch sử. */
function simulate(events: Event[]): string[] {
  let session: ListenSession = emptySession();
  const recorded: string[] = [];
  for (const event of events) {
    const snapshot: PlayerSnapshot = {
      key: "key" in event ? (event.key ?? null) : "A",
      paused: event.paused ?? false,
      loading: event.loading ?? false,
      position: event.position ?? 0,
    };
    const step = nextListenStep(session, snapshot);
    session = step.session;
    if (step.shouldRecord && snapshot.key) recorded.push(snapshot.key);
  }
  return recorded;
}

describe("nextListenStep", () => {
  it("không ghi khi không có bài hát", () => {
    expect(simulate([{ key: null }, { key: null, paused: false }])).toEqual([]);
  });

  it("không ghi khi bài đang tải hoặc đang tạm dừng", () => {
    expect(simulate([{ loading: true }, { paused: true }, { paused: true, loading: true }])).toEqual([]);
  });

  it("ghi đúng một lần khi bài thực sự bắt đầu phát", () => {
    expect(simulate([{ loading: true }, { position: 0 }])).toEqual(["A"]);
  });

  it("các sự kiện lặp và cập nhật tiến trình không tạo bản ghi mới", () => {
    const events: Event[] = [{ position: 0 }];
    for (let position = 500; position <= 60_000; position += 500) events.push({ position });
    expect(simulate(events)).toEqual(["A"]);
  });

  it("tạm dừng rồi tiếp tục không tạo lượt nghe mới", () => {
    expect(
      simulate([
        { position: 0 },
        { position: 20_000 },
        { paused: true, position: 20_000 },
        { paused: true, position: 20_000 },
        { position: 20_000 },
        { position: 21_000 },
      ]),
    ).toEqual(["A"]);
  });

  it("đổi sang bài khác tạo lượt nghe mới cho bài đó", () => {
    expect(simulate([{ key: "A" }, { key: "A", position: 5000 }, { key: "B" }, { key: "B", position: 3000 }])).toEqual(["A", "B"]);
  });

  it("bài kết thúc rồi phát lại là lượt nghe mới", () => {
    expect(
      simulate([
        { position: 0 },
        { position: 150_000 },
        { paused: true, position: 0 }, // SDK báo kết thúc bài
        { position: 0 }, // phát lại
        { position: 4000 },
      ]),
    ).toEqual(["A", "A"]);
  });

  it("bấm phát lại từ đầu sau khi đã nghe >= 10 giây là lượt nghe mới", () => {
    expect(simulate([{ position: 0 }, { position: 30_000 }, { position: 100 }, { position: 2000 }])).toEqual(["A", "A"]);
  });

  it("phát lại từ đầu khi mới nghe vài giây KHÔNG tạo lượt nghe mới", () => {
    expect(simulate([{ position: 0 }, { position: 4000 }, { position: 100 }, { position: 1500 }])).toEqual(["A"]);
  });

  it("tua lùi về giữa bài (không phải đầu bài) không tạo lượt nghe mới", () => {
    expect(simulate([{ position: 0 }, { position: 90_000 }, { position: 30_000 }, { position: 31_000 }])).toEqual(["A"]);
  });

  it("mất trạng thái (null) rồi phát tiếp bài cũ là lượt nghe mới", () => {
    expect(simulate([{ position: 0 }, { position: 20_000 }, { key: null }, { position: 20_000 }])).toEqual(["A", "A"]);
  });

  it("chỉ ghi khi hết loading, dù đã có nhiều sự kiện trước đó", () => {
    expect(simulate([{ loading: true }, { loading: true, position: 0 }, { loading: false, position: 10 }])).toEqual(["A"]);
  });
});

describe("spotifyTrackIdFromUri", () => {
  it("lấy id từ URI bài hát", () => {
    expect(spotifyTrackIdFromUri("spotify:track:4uLU6hMCjMI75M1A2tKUQC")).toBe("4uLU6hMCjMI75M1A2tKUQC");
  });
  it("bỏ qua podcast, local file và giá trị rỗng", () => {
    expect(spotifyTrackIdFromUri("spotify:episode:abc")).toBeNull();
    expect(spotifyTrackIdFromUri("spotify:local:a:b:c:1")).toBeNull();
    expect(spotifyTrackIdFromUri(null)).toBeNull();
    expect(spotifyTrackIdFromUri(undefined)).toBeNull();
    expect(spotifyTrackIdFromUri("")).toBeNull();
  });
});
