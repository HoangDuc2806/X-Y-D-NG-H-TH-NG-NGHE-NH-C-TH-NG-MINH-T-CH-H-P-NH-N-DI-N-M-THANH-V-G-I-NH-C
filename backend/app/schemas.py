"""Pydantic schemas cho Music Data API."""
from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class TrackProvider(str, Enum):
    spotify = "spotify"
    licensed = "licensed"


def _clean_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def _require_https(value: str | None) -> str | None:
    """Chỉ cho phép URL https để tránh lưu scheme nguy hiểm (javascript:, data:)."""
    value = _clean_optional_text(value)
    if value is not None and not value.lower().startswith("https://"):
        raise ValueError("URL phải bắt đầu bằng https://.")
    return value


class TrackMetadataRead(BaseModel):
    """Metadata hiển thị đã lưu. Đọc lỏng để một dòng lạ không làm hỏng cả danh sách."""

    track_name: str | None = None
    artist_name: str | None = None
    album_name: str | None = None
    cover_url: str | None = None
    spotify_url: str | None = None


class TrackMetadata(BaseModel):
    """Metadata hiển thị do client gửi lên (ảnh bìa, tên, nghệ sĩ). Không chứa âm thanh."""

    track_name: str | None = Field(default=None, max_length=200)
    artist_name: str | None = Field(default=None, max_length=500)
    album_name: str | None = Field(default=None, max_length=200)
    cover_url: str | None = Field(default=None, max_length=2048)
    spotify_url: str | None = Field(default=None, max_length=2048)

    @field_validator("track_name", "artist_name", "album_name")
    @classmethod
    def _trim_text(cls, value: str | None) -> str | None:
        return _clean_optional_text(value)

    @field_validator("cover_url", "spotify_url")
    @classmethod
    def _https_urls(cls, value: str | None) -> str | None:
        return _require_https(value)


class ProfileRead(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: UUID
    display_name: str
    created_at: datetime
    updated_at: datetime


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: str = Field(min_length=1, max_length=80)

    @field_validator("display_name")
    @classmethod
    def display_name_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Tên hiển thị không được để trống.")
        return value


class FavoriteRead(TrackMetadataRead):
    model_config = ConfigDict(extra="ignore")

    id: UUID
    user_id: UUID
    provider: TrackProvider
    track_id: str
    created_at: datetime


class FavoriteCreate(TrackMetadata):
    model_config = ConfigDict(extra="forbid")

    provider: TrackProvider
    track_id: str = Field(min_length=1, max_length=200)

    @field_validator("track_id")
    @classmethod
    def track_id_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("track_id không được để trống.")
        return value


class PlaylistRead(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: UUID
    user_id: UUID
    name: str
    description: str
    created_at: datetime
    updated_at: datetime
    # Số bài hát, lấy từ embed `playlist_tracks(count)` của PostgREST (chỉ có ở danh sách).
    track_count: int | None = None

    @model_validator(mode="before")
    @classmethod
    def _extract_track_count(cls, data):
        if isinstance(data, dict) and "track_count" not in data:
            embedded = data.get("playlist_tracks")
            if isinstance(embedded, list) and embedded and isinstance(embedded[0], dict):
                count = embedded[0].get("count")
                if isinstance(count, int):
                    data = {**data, "track_count": count}
        return data


class PlaylistCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)

    @field_validator("name", "description")
    @classmethod
    def trim_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        if not value:
            raise ValueError("Tên playlist không được để trống.")
        return value


class PlaylistUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)

    @field_validator("name", "description")
    @classmethod
    def trim_optional_text(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None

    @field_validator("name")
    @classmethod
    def optional_name_not_blank(cls, value: str | None) -> str | None:
        if value is not None and not value:
            raise ValueError("Tên playlist không được để trống.")
        return value


class PlaylistTrackRead(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: UUID
    playlist_id: UUID
    track_id: str
    track_name: str | None = None
    artist_name: str | None = None
    album_name: str | None = None
    cover_url: str | None = None
    spotify_url: str | None = None
    position: int | None = None
    created_at: datetime | None = None


class PlaylistTrackCreate(TrackMetadata):
    model_config = ConfigDict(extra="forbid")

    track_id: str = Field(min_length=1, max_length=200)
    position: int = Field(default=0, ge=0)

    @field_validator("track_id")
    @classmethod
    def track_id_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("track_id không được để trống.")
        return value


class PlaylistTrackUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    position: int = Field(ge=0)


class PlaylistItemRead(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: UUID
    playlist_id: UUID
    user_id: UUID
    provider: TrackProvider
    track_id: str
    position: int
    added_at: datetime


class PlaylistItemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider: TrackProvider
    track_id: str = Field(min_length=1, max_length=200)
    position: int = Field(default=0, ge=0)

    @field_validator("track_id")
    @classmethod
    def track_id_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("track_id không được để trống.")
        return value


class PlaylistItemUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    position: int = Field(ge=0)


class ListeningHistoryRead(TrackMetadataRead):
    model_config = ConfigDict(extra="ignore")

    id: UUID
    user_id: UUID
    provider: TrackProvider
    track_id: str
    listened_seconds: int
    played_at: datetime


class ListeningHistoryCreate(TrackMetadata):
    model_config = ConfigDict(extra="forbid")

    provider: TrackProvider
    track_id: str = Field(min_length=1, max_length=200)
    listened_seconds: int = Field(default=0, ge=0)

    @field_validator("track_id")
    @classmethod
    def track_id_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("track_id không được để trống.")
        return value
