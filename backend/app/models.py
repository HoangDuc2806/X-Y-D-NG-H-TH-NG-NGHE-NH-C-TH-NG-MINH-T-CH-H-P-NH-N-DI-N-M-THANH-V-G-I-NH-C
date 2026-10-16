"""SQLAlchemy models phản ánh supabase/migrations (RLS nằm trong SQL migration)."""
import uuid
from datetime import datetime
from sqlalchemy import CheckConstraint, DateTime, ForeignKey, ForeignKeyConstraint, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass

class Profile(Base):
    __tablename__ = "profiles"
    __table_args__ = {"schema": "public"}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(80), nullable=False, default="Người dùng")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class Playlist(Base):
    __tablename__ = "playlists"
    __table_args__ = (UniqueConstraint("id", "user_id", name="playlists_id_user_id_key"), {"schema": "public"})
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class PlaylistItem(Base):
    __tablename__ = "playlist_items"
    __table_args__ = (
        ForeignKeyConstraint(["playlist_id", "user_id"], ["public.playlists.id", "public.playlists.user_id"], ondelete="CASCADE"),
        UniqueConstraint("playlist_id", "provider", "track_id"),
        CheckConstraint("position >= 0"),
        {"schema": "public"},
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    playlist_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    provider: Mapped[str] = mapped_column(String(16), nullable=False)
    track_id: Mapped[str] = mapped_column(String(200), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PlaylistTrack(Base):
    """Bảng playlist_tracks của Phase 3; quyền sở hữu được kiểm tra qua RLS của playlist."""
    __tablename__ = "playlist_tracks"
    __table_args__ = (
        CheckConstraint("position IS NULL OR position >= 0"),
        {"schema": "public"},
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    playlist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("public.playlists.id", ondelete="CASCADE"), nullable=False
    )
    track_id: Mapped[str] = mapped_column(Text, nullable=False)
    track_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    artist_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    album_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    spotify_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    position: Mapped[int | None] = mapped_column(Integer, nullable=True, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Favorite(Base):
    __tablename__ = "favorites"
    __table_args__ = (UniqueConstraint("user_id", "provider", "track_id"), {"schema": "public"})
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    provider: Mapped[str] = mapped_column(String(16), nullable=False)
    track_id: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class ListeningHistory(Base):
    __tablename__ = "listening_history"
    __table_args__ = (CheckConstraint("listened_seconds >= 0"), {"schema": "public"})
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    provider: Mapped[str] = mapped_column(String(16), nullable=False)
    track_id: Mapped[str] = mapped_column(String(200), nullable=False)
    listened_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    played_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
