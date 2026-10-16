from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import AuthContext, get_auth_context
from app.core.supabase import SupabaseRestClient, get_user_supabase
from app.schemas import FavoriteCreate, FavoriteRead

router = APIRouter(prefix="/api/favorites", tags=["Favorites"])
FAVORITE_FIELDS = "id,user_id,provider,track_id,track_name,artist_name,album_name,cover_url,spotify_url,created_at"


@router.get("", response_model=list[FavoriteRead])
async def list_favorites(
    context: AuthContext = Depends(get_auth_context),
    db: SupabaseRestClient = Depends(get_user_supabase),
    limit: int = Query(default=100, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[dict]:
    return await db.select(
        "favorites",
        select=FAVORITE_FIELDS,
        filters={"user_id": f"eq.{context.user.id}"},
        order="created_at.desc,id.desc",
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=FavoriteRead, status_code=status.HTTP_201_CREATED)
async def add_favorite(
    payload: FavoriteCreate,
    context: AuthContext = Depends(get_auth_context),
    db: SupabaseRestClient = Depends(get_user_supabase),
) -> dict:
    favorite_payload = {
        "user_id": str(context.user.id),
        **payload.model_dump(mode="json", exclude_none=True),
    }
    rows = await db.insert(
        "favorites",
        favorite_payload,
        select=FAVORITE_FIELDS,
        params={"on_conflict": "user_id,provider,track_id"},
        # DO NOTHING avoids requiring a broad UPDATE RLS policy just to handle duplicates.
        prefer="resolution=ignore-duplicates,return=representation",
    )
    if rows:
        return rows[0]

    # A duplicate may produce an empty representation. Return the existing row instead.
    existing = await db.select(
        "favorites",
        select=FAVORITE_FIELDS,
        filters={
            "user_id": f"eq.{context.user.id}",
            "provider": f"eq.{payload.provider.value}",
            "track_id": f"eq.{payload.track_id}",
        },
        limit=1,
    )
    if existing:
        return existing[0]
    raise HTTPException(status_code=503, detail="Không nhận được dữ liệu yêu thích từ Supabase.")


@router.delete("/{favorite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_favorite(
    favorite_id: UUID,
    context: AuthContext = Depends(get_auth_context),
    db: SupabaseRestClient = Depends(get_user_supabase),
) -> None:
    # Lọc cả user_id (ngoài RLS) để không bao giờ xóa dòng của người khác.
    rows = await db.delete(
        "favorites",
        filters={"id": f"eq.{favorite_id}", "user_id": f"eq.{context.user.id}"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài hát yêu thích.")
