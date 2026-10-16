"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AudioLines,
  CheckCircle2,
  ExternalLink,
  FileAudio,
  LoaderCircle,
  Mic,
  RotateCcw,
  Search,
  Square,
} from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/components/providers";
import { identifyAudio, type MusicRecognitionResponse } from "@/lib/api";
import { requireSupabase } from "@/lib/supabase";

const panel = "rounded-2xl border border-ink-700 bg-ink-900 p-5 sm:p-6";
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const RECORDING_LIMIT_SECONDS = 15;

function formatBytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function IdentifyContent() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<MusicRecognitionResponse | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const intervalRef = useRef<number | null>(null);
  const autoStopRef = useRef<number | null>(null);

  function clearRecordingTimers() {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    if (autoStopRef.current !== null) window.clearTimeout(autoStopRef.current);
    intervalRef.current = null;
    autoStopRef.current = null;
  }

  function stopMicrophoneTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    return () => {
      clearRecordingTimers();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      stopMicrophoneTracks();
    };
    // The refs are stable; this effect is only for unmount cleanup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function acceptFile(nextFile: File | null) {
    setError("");
    setResult(null);
    if (nextFile && nextFile.size > MAX_FILE_BYTES) {
      setFile(null);
      setError("Tệp quá lớn. Vui lòng chọn tệp không vượt quá 20 MB.");
      return;
    }
    setFile(nextFile);
  }

  async function startRecording() {
    setError("");
    setResult(null);
    setFile(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Trình duyệt này không hỗ trợ ghi âm. Hãy tải lên một tệp âm thanh thay thế.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setError("Trình duyệt chưa hỗ trợ MediaRecorder. Hãy cập nhật trình duyệt hoặc tải tệp âm thanh lên.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find(
        (candidate) => MediaRecorder.isTypeSupported(candidate),
      );
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setError("Không thể ghi âm. Hãy thử lại hoặc tải tệp âm thanh lên.");
        setRecording(false);
        clearRecordingTimers();
        stopMicrophoneTracks();
      };
      recorder.onstop = () => {
        clearRecordingTimers();
        stopMicrophoneTracks();
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size === 0) {
          setError("Không thu được âm thanh. Hãy cấp quyền micro và thử lại.");
          return;
        }
        const extension = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
        acceptFile(new File([blob], `ghi-am-${Date.now()}.${extension}`, { type: blob.type }));
      };

      recorder.start(250);
      startedAtRef.current = Date.now();
      setRecordingSeconds(0);
      setRecording(true);
      intervalRef.current = window.setInterval(() => {
        setRecordingSeconds(Math.min(RECORDING_LIMIT_SECONDS, Math.floor((Date.now() - startedAtRef.current) / 1000)));
      }, 250);
      autoStopRef.current = window.setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, RECORDING_LIMIT_SECONDS * 1000);
    } catch (caught) {
      stopMicrophoneTracks();
      const message = caught instanceof Error && caught.name === "NotAllowedError"
        ? "Bạn chưa cấp quyền sử dụng micro. Hãy cho phép micro trong trình duyệt rồi thử lại."
        : "Không mở được micro. Kiểm tra thiết bị và quyền truy cập micro của trình duyệt.";
      setError(message);
    }
  }

  function stopRecording() {
    clearRecordingTimers();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  async function runIdentification() {
    if (!file || !user) return;
    setError("");
    setResult(null);
    setBusy(true);
    try {
      const { data, error: sessionError } = await requireSupabase().auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session?.access_token) throw new Error("Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.");
      const response = await identifyAudio(file, data.session.access_token);
      setResult(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể nhận diện âm thanh lúc này.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError("");
    setRecordingSeconds(0);
    const input = document.getElementById("audio-file") as HTMLInputElement | null;
    if (input) input.value = "";
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <section className={panel} aria-labelledby="record-title">
          <h2 id="record-title" className="flex items-center gap-2 text-xl font-bold">
            <Mic size={21} className="text-lime-400" /> Thu âm hoặc tải tệp
          </h2>
          <p className="mb-5 mt-2 text-sm leading-relaxed text-mist-300">
            Để micro gần nguồn nhạc và ghi một đoạn rõ khoảng 10–15 giây. Bạn cũng có thể tải lên một tệp âm thanh có sẵn.
          </p>

          <div className="rounded-2xl border border-ink-700 bg-ink-950 p-5 text-center">
            <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${recording ? "bg-red-500/15 text-red-300" : "bg-lime-400/10 text-lime-400"}`}>
              {recording ? <AudioLines size={30} className="animate-pulse" /> : <Mic size={30} />}
            </div>
            <p className="text-2xl font-semibold tabular-nums">{formatDuration(recordingSeconds)}</p>
            <p className="mb-4 mt-1 text-xs text-mist-300">
              {recording ? `Đang ghi âm · tự dừng sau ${RECORDING_LIMIT_SECONDS} giây` : "Micro chỉ hoạt động khi bạn chủ động bấm ghi âm."}
            </p>
            {recording ? (
              <button type="button" onClick={stopRecording} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-500 px-5 py-3 text-sm font-semibold text-white hover:bg-red-400">
                <Square size={16} /> Dừng ghi âm
              </button>
            ) : (
              <button type="button" onClick={() => void startRecording()} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-lime-400 px-5 py-3 text-sm font-semibold text-ink-950 hover:bg-lime-300 disabled:opacity-50">
                <Mic size={16} /> Bắt đầu ghi âm
              </button>
            )}
          </div>

          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-widest text-mist-400">
            <span className="h-px flex-1 bg-ink-700" /> hoặc tải lên <span className="h-px flex-1 bg-ink-700" />
          </div>

          <label htmlFor="audio-file" className="flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-ink-600 bg-ink-950/60 p-5 text-center transition hover:border-lime-500">
            <FileAudio size={25} className="mb-2 text-lime-400" />
            <span className="text-sm font-semibold">Chọn tệp âm thanh</span>
            <span className="mt-1 text-xs text-mist-300">MP3, WAV, FLAC, OGG, M4A, AAC, WebM · tối đa 20 MB</span>
            <input
              id="audio-file"
              type="file"
              accept="audio/*,.mp3,.wav,.flac,.ogg,.oga,.m4a,.mp4,.aac,.webm,.opus"
              className="sr-only"
              disabled={busy || recording}
              onChange={(event) => acceptFile(event.target.files?.[0] ?? null)}
            />
          </label>

          {file && (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-950 p-3">
              <FileAudio size={20} className="shrink-0 text-lime-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-mist-300">{formatBytes(file.size)}</p>
              </div>
              <button type="button" onClick={reset} disabled={busy} className="rounded-lg px-2 py-1 text-xs text-mist-300 hover:bg-ink-800">Bỏ tệp</button>
            </div>
          )}

          <button
            type="button"
            onClick={() => void runIdentification()}
            disabled={!file || busy || recording}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-lime-400 px-4 py-3 font-semibold text-ink-950 transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <LoaderCircle size={18} className="animate-spin" /> : <Search size={18} />}
            {busy ? "Đang phân tích âm thanh…" : "Nhận diện bài hát"}
          </button>
          <p className="mt-3 text-xs leading-relaxed text-mist-400">Âm thanh được xử lý tạm thời trên backend và không được lưu thành tệp trong thư viện.</p>
        </section>

        <section className={panel} aria-labelledby="results-title" aria-live="polite">
          <h2 id="results-title" className="flex items-center gap-2 text-xl font-bold">
            <AudioLines size={21} className="text-lime-400" /> Kết quả nhận diện
          </h2>
          <p className="mb-5 mt-2 text-sm text-mist-300">Thông tin được tra cứu từ cơ sở dữ liệu dấu vân tay âm thanh AcoustID và MusicBrainz.</p>

          {error && (
            <div role="alert" className="flex gap-3 rounded-xl border border-red-800/70 bg-red-950/30 p-4 text-sm text-red-200">
              <AlertCircle size={19} className="mt-0.5 shrink-0" /> <p>{error}</p>
            </div>
          )}

          {!error && !result && (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-ink-700 p-6 text-center">
              <div className="mb-3 rounded-2xl bg-ink-800 p-4 text-mist-300"><Search size={27} /></div>
              <p className="font-semibold">Chưa có kết quả</p>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-mist-300">Ghi âm một đoạn nhạc hoặc chọn tệp, sau đó bấm “Nhận diện bài hát”.</p>
            </div>
          )}

          {result && result.status === "not_found" && (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-ink-700 p-6 text-center">
              <AlertCircle size={28} className="mb-3 text-amber-300" />
              <p className="font-semibold">Chưa tìm thấy bài hát</p>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-mist-300">{result.message}</p>
              <p className="mt-2 text-xs text-mist-400">Đoạn đã phân tích: {result.duration_seconds} giây</p>
            </div>
          )}

          {result && result.status === "matched" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-lime-600/30 bg-lime-400/5 p-4">
                <CheckCircle2 size={21} className="mt-0.5 shrink-0 text-lime-400" />
                <div>
                  <p className="font-semibold text-lime-300">Đã tìm thấy kết quả phù hợp</p>
                  <p className="mt-1 text-sm text-mist-300">{result.message}</p>
                </div>
              </div>
              {result.results.map((track, index) => (
                <article key={track.musicbrainz_recording_id ?? track.acoustid_id ?? `${track.title}-${index}`} className="rounded-xl border border-ink-700 bg-ink-950 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-lime-400"><AudioLines size={23} /></div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold leading-snug">{track.title}</h3>
                      <p className="mt-1 text-sm text-mist-300">{track.artists.length ? track.artists.join(", ") : "Chưa có thông tin nghệ sĩ"}</p>
                      {(track.album || track.year) && <p className="mt-1 text-xs text-mist-400">{[track.album, track.year].filter(Boolean).join(" · ")}</p>}
                    </div>
                    <span className="shrink-0 rounded-full bg-ink-800 px-2.5 py-1 text-xs tabular-nums text-lime-300">{Math.round(track.score * 100)}% khớp</span>
                  </div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink-800">
                    <div className="h-full rounded-full bg-lime-400" style={{ width: `${Math.round(track.score * 100)}%` }} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs">
                    <Link href={`/search?q=${encodeURIComponent(`${track.title} ${track.artists.join(" ")}`)}`} className="inline-flex items-center gap-1 rounded-lg bg-lime-400 px-3 py-2 font-semibold text-ink-950 hover:bg-lime-300">Tìm bài này trên Spotify <ExternalLink size={12} /></Link>
                    {track.musicbrainz_url && <a href={track.musicbrainz_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-ink-700 px-3 py-2 text-lime-300 hover:underline">MusicBrainz <ExternalLink size={12} /></a>}
                    {track.acoustid_url && <a href={track.acoustid_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-ink-700 px-3 py-2 text-mist-300 hover:text-lime-300 hover:underline">AcoustID <ExternalLink size={12} /></a>}
                  </div>
                </article>
              ))}
              <p className="text-xs leading-relaxed text-mist-400">Độ khớp là điểm do AcoustID trả về, không phải xác suất chắc chắn. Hãy nghe và đối chiếu kết quả trước khi sử dụng.</p>
              <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-xl border border-ink-700 px-4 py-2 text-sm hover:border-lime-500"><RotateCcw size={15} /> Nhận diện đoạn khác</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <>
      <PageHeader title="Nhận diện bài hát" description="Dùng micro hoặc tải tệp âm thanh để tìm tên bài hát, nghệ sĩ và album." />
      <AuthGate><IdentifyContent /></AuthGate>
    </>
  );
}
