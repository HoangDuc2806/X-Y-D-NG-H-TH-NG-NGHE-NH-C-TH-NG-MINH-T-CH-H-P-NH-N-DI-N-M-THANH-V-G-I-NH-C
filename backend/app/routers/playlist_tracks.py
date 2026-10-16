from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.core.supabase import SupabaseRestClient, get_user_supabase
from app.schemas import PlaylistTrackCreate, PlaylistTrackRead, PlaylistTrackUpdate

router = APIRouter(prefix="/api/playlists/{playlist_id}/tracks", tags=["Playlist Tracks"])
TRACK_FIELDS = "id,playlist_id,track_id,track_name,artist_name,album_name,cover_url,spotify_url,position,created_at"


@router.get("", response_model=list[PlaylistTrackRead])
async def list_playlist_tracks(
    playlist_id: UUID,
    db: SupabaseRestClient = Depends(get_user_supabase),
) -> list[dict]:
    # RLS của playlist_tracks kiểm tra playlist_id thuộc playlist của user hiện tại.
    return await db.select(
        "playlist_tracks",
        select=TRACK_FIELDS,
        filters={"playlist_id": f"eq.{playlist_id}"},
        order="position.asc,created_at.asc",
    )


@router.post("", response_model=PlaylistTrackRead, status_code=201)
async def add_playlist_track(
    playlist_id: UUID,
    payload: PlaylistTrackCreate,
    db: SupabaseRestClient = Depends(get_user_supabase),
) -> dict:
    rows = await db.insert(
        "playlist_tracks",
        {"playlist_id": str(playlist_id), **payload.model_dump()},
        select=TRACK_FIELDS,
    )
    if not rows:
        raise HTTPException(status_code=503, detail="Không nhận được bài hát từ Supabase.")
    return rows[0]


@router.patch("/{track_row_id}", response_model=PlaylistTrackRead)
async def update_playlist_track(
    playlist_id: UUID,
    track_row_id: UUID,
    payload: PlaylistTrackUpdate,
    db: SupabaseRestClient = Depends(get_user_supabase),
) -> dict:
    rows = await db.update(
        "playlist_tracks",
        payload.model_dump(),
        filters={"id": f"eq.{track_row_id}", "playlist_id": f"eq.{playlist_id}"},
        select=TRACK_FIELDS,
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài hát trong playlist.")
    return rows[0]


@router.delete("/{track_row_id}", status_code=204)
async def delete_playlist_track(
    playlist_id: UUID,
    track_row_id: UUID,
    db: SupabaseRestClient = Depends(get_user_supabase),
) -> None:
    rows = await db.delete(
        "playlist_tracks",
        filters={"id": f"eq.{track_row_id}", "playlist_id": f"eq.{playlist_id}"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài hát trong playlist.")
