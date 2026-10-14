from fastapi import APIRouter, Depends
from app.core.auth import AuthenticatedUser, get_current_user

router = APIRouter(prefix="/api", tags=["Tài khoản"])

@router.get("/me", response_model=AuthenticatedUser)
async def get_me(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
    """Token được Supabase Auth xác thực trước khi trả thông tin chủ sở hữu."""
    return user
