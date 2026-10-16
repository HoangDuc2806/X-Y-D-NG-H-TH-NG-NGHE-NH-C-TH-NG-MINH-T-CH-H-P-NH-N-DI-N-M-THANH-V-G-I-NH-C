from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import AuthContext, get_auth_context
from app.core.supabase import SupabaseRestClient, get_user_supabase
from app.schemas import ProfileRead, ProfileUpdate

router = APIRouter(prefix="/api/profile", tags=["Profile"])
PROFILE_FIELDS = "id,display_name,created_at,updated_at"


@router.get("", response_model=ProfileRead)
async def get_profile(
    context: AuthContext = Depends(get_auth_context),
    db: SupabaseRestClient = Depends(get_user_supabase),
) -> dict:
    rows = await db.select(
        "profiles",
        select=PROFILE_FIELDS,
        filters={"id": f"eq.{context.user.id}"},
        limit=1,
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Hồ sơ không tồn tại.")
    return rows[0]


@router.patch("", response_model=ProfileRead)
async def update_profile(
    payload: ProfileUpdate,
    context: AuthContext = Depends(get_auth_context),
    db: SupabaseRestClient = Depends(get_user_supabase),
) -> dict:
    rows = await db.update(
        "profiles",
        payload.model_dump(),
        filters={"id": f"eq.{context.user.id}"},
        select=PROFILE_FIELDS,
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Hồ sơ không tồn tại.")
    return rows[0]
