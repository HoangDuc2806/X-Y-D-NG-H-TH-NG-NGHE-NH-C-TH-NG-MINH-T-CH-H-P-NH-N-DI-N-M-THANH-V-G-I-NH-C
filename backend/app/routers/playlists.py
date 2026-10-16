from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import AuthContext, get_auth_context
from app.core.supabase import SupabaseRestClient, get_user_supabase
from app.schemas import PlaylistCreate, PlaylistRead, PlaylistUpdate

router = APIRouter(prefix="/api/playlists", tags=["Playlists"])
PLAYLIST_FIELDS = "id,user_id,name,description,created_at,updated_at"


@router.get("", response_model=list[PlaylistRead])
async def list_playlists(
    context: AuthContext = Depends(get_auth_context),
    db: SupabaseRestClient = Depends(get_user_supabase),
    limit: int = Query(default=100, ge=1, le=100),
) -> list[dict]:
    return await db.select(
        "playlists",
        select=PLAYLIST_FIELDS,
        filters={"user_id": f"eq.{context.user.id}"},
        order="created_at.desc",
        limit=limit,
    )


@router.post("", response_model=PlaylistRead, status_code=status.HTTP_201_CREATED)
async def create_playlist(
    payload: PlaylistCreate,
    context: AuthContext = Depends(get_auth_context),
    db: SupabaseRestClient = Depends(get_user_supabase),
) -> dict:
    rows = await db.insert(
        "playlists",
        {"user_id": str(context.user.id), **payload.model_dump()},
        select=PLAYLIST_FIELDS,
    )
    if not rows:
        raise HTTPException(status_code=503, detail="Không nhận được playlist từ Supabase.")
    return rows[0]


@router.patch("/{playlist_id}", response_model=PlaylistRead)
async def update_playlist(
    playlist_id: UUID,
    payload: PlaylistUpdate,
    db: SupabaseRestClient = Depends(get_user_supabase),
) -> dict:
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="Cần ít nhất một trường để cập nhật.")
    rows = await db.update(
        "playlists",
        changes,
        filters={"id": f"eq.{playlist_id}"},
        select=PLAYLIST_FIELDS,
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Không tìm thấy playlist.")
    return rows[0]


@router.delete("/{playlist_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_playlist(
    playlist_id: UUID,
    db: SupabaseRestClient = Depends(get_user_supabase),
) -> None:
    rows = await db.delete("playlists", filters={"id": f"eq.{playlist_id}"})
    if not rows:
        raise HTTPException(status_code=404, detail="Không tìm thấy playlist.")
