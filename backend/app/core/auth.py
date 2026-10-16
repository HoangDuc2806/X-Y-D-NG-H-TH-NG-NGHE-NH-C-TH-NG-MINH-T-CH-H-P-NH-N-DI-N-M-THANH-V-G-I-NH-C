"""Xác thực Bearer token qua Supabase Auth và tạo context cho API dữ liệu."""
from dataclasses import dataclass
from uuid import UUID

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.core.config import Settings, get_settings

bearer = HTTPBearer(auto_error=False)


class AuthenticatedUser(BaseModel):
    id: UUID
    email: str | None = None


@dataclass(frozen=True)
class AuthContext:
    """User đã được Supabase xác thực + access token dùng để gọi PostgREST."""

    user: AuthenticatedUser
    access_token: str


async def _authenticate(
    credentials: HTTPAuthorizationCredentials | None,
    settings: Settings,
) -> AuthContext:
    if credentials is None or credentials.scheme.lower() != "bearer" or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cần đăng nhập để tiếp tục.",
        )

    if not settings.supabase_url or not settings.supabase_publishable_key:
        raise HTTPException(status_code=503, detail="Backend chưa cấu hình Supabase Auth.")

    endpoint = f"{settings.supabase_url.rstrip('/')}/auth/v1/user"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                endpoint,
                headers={
                    "apikey": settings.supabase_publishable_key,
                    "Authorization": f"Bearer {credentials.credentials}",
                },
            )
    except (httpx.TimeoutException, httpx.RequestError) as exc:
        raise HTTPException(status_code=503, detail="Không liên lạc được máy chủ xác thực.") from exc

    if response.status_code in (400, 401, 403):
        raise HTTPException(status_code=401, detail="Phiên đăng nhập không hợp lệ hoặc đã hết hạn.")
    if response.status_code != 200:
        raise HTTPException(status_code=503, detail="Dịch vụ xác thực tạm thời không khả dụng.")

    try:
        user = AuthenticatedUser.model_validate(response.json())
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=503, detail="Phản hồi xác thực không hợp lệ.") from exc

    return AuthContext(user=user, access_token=credentials.credentials)


async def get_auth_context(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    settings: Settings = Depends(get_settings),
) -> AuthContext:
    """Xác thực token một lần và giữ token để PostgREST áp RLS theo user hiện tại."""
    return await _authenticate(credentials, settings)


async def get_current_user(
    context: AuthContext = Depends(get_auth_context),
) -> AuthenticatedUser:
    """Dependency tương thích cho các endpoint chỉ cần thông tin user."""
    return context.user
