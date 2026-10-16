"""Compatibility API cho bảng playlist_items của Phase 2.

Không đồng bộ dữ liệu sang playlist_tracks và không xóa bảng cũ ở Phase 3.2.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import AuthContext, get_auth_context
from app.core.supabase import SupabaseRestClient, get_user_supabase
from app.schemas import PlaylistItemCreate, PlaylistItemRead, PlaylistItemUpdate

router = APIRouter(prefix="/api/playlists/{playlist_id}/items", tags=["Playlist Items (legacy)"])
ITEM_FIELDS = "id,playlist_id,user_id,provider,track_id,position,added_at"


@router.get("", response_model=list[PlaylistItemRead])
async def list_playlist_items(
    playlist_id: UUID,
    context: AuthContext = Depends(get_auth_context),
    db: SupabaseRestClient = Depends(get_user_supabase),
) -> list[dict]:
    return await db.select(
        "playlist_items",
        select=ITEM_FIELDS,
        filters={"playlist_id": f"eq.{playlist_id}", "user_id": f"eq.{context.user.id}"},
        order="position.asc,added_at.asc",
    )


@router.post("", response_model=PlaylistItemRead, status_code=201)
async def add_playlist_item(
    playlist_id: UUID,
    payload: PlaylistItemCreate,
    context: AuthContext = Depends(get_auth_context),
    db: SupabaseRestClient = Depends(get_user_supabase),
) -> dict:
    rows = await db.insert(
        "playlist_items",
        {"playlist_id": str(playlist_id), "user_id": str(context.user.id), **payload.model_dump(mode="json")},
        select=ITEM_FIELDS,
    )
    if not rows:
        raise HTTPException(status_code=503, detail="Không nhận được mục playlist từ Supabase.")
    return rows[0]


@router.patch("/{item_id}", response_model=PlaylistItemRead)
async def update_playlist_item(
    playlist_id: UUID,
    item_id: UUID,
    payload: PlaylistItemUpdate,
    context: AuthContext = Depends(get_auth_context),
    db: SupabaseRestClient = Depends(get_user_supabase),
) -> dict:
    rows = await db.update(
        "playlist_items",
        payload.model_dump(),
        filters={
            "id": f"eq.{item_id}",
            "playlist_id": f"eq.{playlist_id}",
            "user_id": f"eq.{context.user.id}",
        },
        select=ITEM_FIELDS,
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Không tìm thấy mục playlist.")
    return rows[0]


@router.delete("/{item_id}", status_code=204)
async def delete_playlist_item(
    playlist_id: UUID,
    item_id: UUID,
    context: AuthContext = Depends(get_auth_context),
    db: SupabaseRestClient = Depends(get_user_supabase),
) -> None:
    rows = await db.delete(
        "playlist_items",
        filters={
            "id": f"eq.{item_id}",
            "playlist_id": f"eq.{playlist_id}",
            "user_id": f"eq.{context.user.id}",
        },
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Không tìm thấy mục playlist.")
