import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.core.auth import AuthContext, get_auth_context
from app.core.supabase import SupabaseRestClient, get_user_supabase
from app.schemas import ListeningHistoryCreate, ListeningHistoryRead

log = logging.getLogger("app.history")

router = APIRouter(prefix="/api/listening-history", tags=["Listening History"])
HISTORY_FIELDS = "id,user_id,provider,track_id,track_name,artist_name,album_name,cover_url,spotify_url,listened_seconds,played_at"

# Quy tắc lượt nghe: cùng user + provider + track_id được ghi nhận lại trong cửa sổ này
# sẽ bị coi là cùng một lượt nghe (chống sự kiện trình phát bắn lặp, 2 tab, React StrictMode).
# Phát lại bài sau khoảng thời gian này là một lượt nghe mới.
HISTORY_DEDUPE_WINDOW = timedelta(seconds=15)


@router.get("", response_model=list[ListeningHistoryRead])
async def list_listening_history(
    context: AuthContext = Depends(get_auth_context),
    db: SupabaseRestClient = Depends(get_user_supabase),
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[dict]:
    return await db.select(
        "listening_history",
        select=HISTORY_FIELDS,
        filters={"user_id": f"eq.{context.user.id}"},
        order="played_at.desc,id.desc",
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=ListeningHistoryRead, status_code=status.HTTP_201_CREATED)
async def record_listening_history(
    payload: ListeningHistoryCreate,
    response: Response,
    context: AuthContext = Depends(get_auth_context),
    db: SupabaseRestClient = Depends(get_user_supabase),
) -> dict:
    """Ghi một lượt nghe. Trả 201 khi tạo mới, 200 khi trùng lượt nghe vừa ghi."""
    latest = await db.select(
        "listening_history",
        select=HISTORY_FIELDS,
        filters={
            "user_id": f"eq.{context.user.id}",
            "provider": f"eq.{payload.provider.value}",
            "track_id": f"eq.{payload.track_id}",
        },
        order="played_at.desc",
        limit=1,
    )
    if latest:
        try:
            last_played = ListeningHistoryRead.model_validate(latest[0]).played_at
            if last_played.tzinfo is None:
                last_played = last_played.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) - last_played < HISTORY_DEDUPE_WINDOW:
                response.status_code = status.HTTP_200_OK
                return latest[0]
        except ValueError:
            log.warning("Không đọc được played_at của lượt nghe gần nhất; bỏ qua bước chống trùng.")

    rows = await db.insert(
        "listening_history",
        {"user_id": str(context.user.id), **payload.model_dump(mode="json", exclude_none=True)},
        select=HISTORY_FIELDS,
    )
    if not rows:
        raise HTTPException(status_code=503, detail="Không nhận được lịch sử nghe từ Supabase.")
    return rows[0]


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def clear_listening_history(
    context: AuthContext = Depends(get_auth_context),
    db: SupabaseRestClient = Depends(get_user_supabase),
) -> None:
    """Xóa toàn bộ lịch sử nghe của chính người dùng hiện tại."""
    await db.delete("listening_history", filters={"user_id": f"eq.{context.user.id}"})


@router.delete("/{history_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_listening_history(
    history_id: UUID,
    context: AuthContext = Depends(get_auth_context),
    db: SupabaseRestClient = Depends(get_user_supabase),
) -> None:
    rows = await db.delete(
        "listening_history",
        filters={"id": f"eq.{history_id}", "user_id": f"eq.{context.user.id}"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Không tìm thấy lượt nghe.")
