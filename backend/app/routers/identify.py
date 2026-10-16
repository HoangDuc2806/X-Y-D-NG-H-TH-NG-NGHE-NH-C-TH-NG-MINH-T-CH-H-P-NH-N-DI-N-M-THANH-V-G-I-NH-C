"""Identify a user-provided audio clip using Chromaprint and AcoustID."""

from pathlib import Path
import tempfile
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field

from app.core.auth import AuthContext, get_auth_context
from app.core.config import Settings, get_settings
from app.services.music_recognition import (
    AcoustIDUnavailable,
    FingerprintTimeout,
    FingerprintToolMissing,
    InvalidAudioFile,
    generate_fingerprint,
    lookup_acoustid,
    parse_acoustid_matches,
)

router = APIRouter(prefix="/api/identify", tags=["Music Recognition"])
ALLOWED_EXTENSIONS = {".mp3", ".wav", ".flac", ".ogg", ".oga", ".m4a", ".mp4", ".aac", ".webm", ".opus"}
ALLOWED_NON_AUDIO_MIME_TYPES = {"application/octet-stream", "video/mp4"}


class RecognizedTrack(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    artists: list[str] = Field(default_factory=list)
    album: str | None = None
    year: int | None = None
    score: float = Field(ge=0, le=1)
    acoustid_id: str | None = None
    musicbrainz_recording_id: str | None = None
    musicbrainz_url: str | None = None
    acoustid_url: str | None = None


class MusicRecognitionResponse(BaseModel):
    status: Literal["matched", "not_found"]
    message: str
    duration_seconds: int
    results: list[RecognizedTrack]


def _validate_upload(file: UploadFile) -> str:
    suffix = Path(file.filename or "audio").suffix.lower()
    content_type = (file.content_type or "").lower().split(";", 1)[0].strip()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail="Định dạng chưa được hỗ trợ. Hãy dùng MP3, WAV, FLAC, OGG, M4A, AAC hoặc WebM.",
        )
    if content_type and not content_type.startswith("audio/") and content_type not in ALLOWED_NON_AUDIO_MIME_TYPES:
        raise HTTPException(status_code=415, detail="Tệp tải lên không phải tệp âm thanh hợp lệ.")
    return suffix


@router.post("", response_model=MusicRecognitionResponse)
async def identify_music(
    file: UploadFile = File(..., description="Tệp âm thanh cần nhận diện; tối đa 20 MB theo cấu hình mặc định."),
    _context: AuthContext = Depends(get_auth_context),
    settings: Settings = Depends(get_settings),
) -> MusicRecognitionResponse:
    """Generate a temporary fingerprint and query AcoustID; audio is not stored permanently."""
    if not settings.acoustid_client_key.strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Backend chưa cấu hình ACOUSTID_CLIENT_KEY.",
        )

    suffix = _validate_upload(file)
    max_bytes = max(1, settings.recognition_max_upload_bytes)
    temporary_path: Path | None = None
    try:
        content = await file.read(max_bytes + 1)
        if not content:
            raise HTTPException(status_code=422, detail="Tệp âm thanh đang trống.")
        if len(content) > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"Tệp quá lớn. Giới hạn hiện tại là {max_bytes // (1024 * 1024)} MB.",
            )

        with tempfile.NamedTemporaryFile(prefix="music-discovery-", suffix=suffix, delete=False) as temp:
            temp.write(content)
            temporary_path = Path(temp.name)

        try:
            duration, fingerprint = await generate_fingerprint(
                temporary_path,
                fpcalc_path=settings.chromaprint_fpcalc_path,
                fingerprint_length_seconds=max(10, settings.recognition_fingerprint_length_seconds),
            )
        except FingerprintToolMissing as exc:
            raise HTTPException(
                status_code=503,
                detail="Không tìm thấy Chromaprint fpcalc. Cài đặt fpcalc và cấu hình CHROMAPRINT_FPCALC_PATH.",
            ) from exc
        except FingerprintTimeout as exc:
            raise HTTPException(status_code=504, detail="Xử lý âm thanh quá lâu. Hãy thử một đoạn ngắn hơn.") from exc
        except InvalidAudioFile as exc:
            raise HTTPException(
                status_code=422,
                detail="Không đọc được tệp âm thanh. Hãy thử tệp khác hoặc chuyển sang WAV/MP3.",
            ) from exc

        if duration < settings.recognition_min_duration_seconds:
            raise HTTPException(
                status_code=422,
                detail=f"Đoạn âm thanh quá ngắn. Cần ít nhất {settings.recognition_min_duration_seconds} giây.",
            )
        if duration > settings.recognition_max_duration_seconds:
            raise HTTPException(status_code=413, detail="Tệp âm thanh quá dài. Hãy chọn tệp ngắn hơn.")

        try:
            acoustid_payload = await lookup_acoustid(settings.acoustid_client_key.strip(), fingerprint, duration)
        except AcoustIDUnavailable as exc:
            raise HTTPException(
                status_code=503,
                detail="Dịch vụ AcoustID tạm thời không khả dụng hoặc API key chưa hợp lệ.",
            ) from exc

        results = parse_acoustid_matches(acoustid_payload)
        if not results:
            return MusicRecognitionResponse(
                status="not_found",
                message="Chưa tìm thấy bài hát phù hợp. Hãy thử đoạn âm thanh rõ hơn hoặc một tệp khác.",
                duration_seconds=duration,
                results=[],
            )
        return MusicRecognitionResponse(
            status="matched",
            message="Đã tìm thấy thông tin bài hát có khả năng khớp với âm thanh.",
            duration_seconds=duration,
            results=[RecognizedTrack.model_validate(item) for item in results],
        )
    finally:
        await file.close()
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
