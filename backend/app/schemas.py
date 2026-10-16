"""Pydantic schemas cho Music Data API."""
from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TrackProvider(str, Enum):
    spotify = "spotify"
    licensed = "licensed"


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


class FavoriteRead(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: UUID
    user_id: UUID
    provider: TrackProvider
    track_id: str
    created_at: datetime


class FavoriteCreate(BaseModel):
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


class PlaylistTrackCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    track_id: str = Field(min_length=1, max_length=200)
    track_name: str | None = Field(default=None, max_length=200)
    artist_name: str | None = Field(default=None, max_length=200)
    album_name: str | None = Field(default=None, max_length=200)
    cover_url: str | None = Field(default=None, max_length=2048)
    spotify_url: str | None = Field(default=None, max_length=2048)
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


class ListeningHistoryRead(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: UUID
    user_id: UUID
    provider: TrackProvider
    track_id: str
    listened_seconds: int
    played_at: datetime


class ListeningHistoryCreate(BaseModel):
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
