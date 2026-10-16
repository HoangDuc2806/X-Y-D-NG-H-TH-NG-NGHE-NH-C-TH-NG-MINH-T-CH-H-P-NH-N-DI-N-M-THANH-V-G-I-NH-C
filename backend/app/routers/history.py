from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import AuthContext, get_auth_context
from app.core.supabase import SupabaseRestClient, get_user_supabase
from app.schemas import ListeningHistoryCreate, ListeningHistoryRead

router = APIRouter(prefix="/api/listening-history", tags=["Listening History"])
HISTORY_FIELDS = "id,user_id,provider,track_id,listened_seconds,played_at"


@router.get("", response_model=list[ListeningHistoryRead])
async def list_listening_history(
    context: AuthContext = Depends(get_auth_context),
    db: SupabaseRestClient = Depends(get_user_supabase),
    limit: int = Query(default=30, ge=1, le=100),
) -> list[dict]:
    return await db.select(
        "listening_history",
        select=HISTORY_FIELDS,
        filters={"user_id": f"eq.{context.user.id}"},
        order="played_at.desc",
        limit=limit,
    )


@router.post("", response_model=ListeningHistoryRead, status_code=status.HTTP_201_CREATED)
async def record_listening_history(
    payload: ListeningHistoryCreate,
    context: AuthContext = Depends(get_auth_context),
    db: SupabaseRestClient = Depends(get_user_supabase),
) -> dict:
    rows = await db.insert(
        "listening_history",
        {"user_id": str(context.user.id), **payload.model_dump(mode="json")},
        select=HISTORY_FIELDS,
    )
    if not rows:
        raise HTTPException(status_code=503, detail="Không nhận được lịch sử nghe từ Supabase.")
    return rows[0]


@router.delete("/{history_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_listening_history(
    history_id: UUID,
    db: SupabaseRestClient = Depends(get_user_supabase),
) -> None:
    rows = await db.delete("listening_history", filters={"id": f"eq.{history_id}"})
    if not rows:
        raise HTTPException(status_code=404, detail="Không tìm thấy lượt nghe.")
