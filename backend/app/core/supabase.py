"""Client PostgREST dùng access token của user; không dùng service-role key."""
from __future__ import annotations

from typing import Any

import httpx
from fastapi import Depends, HTTPException

from app.core.auth import AuthContext, get_auth_context
from app.core.config import Settings, get_settings


class SupabaseRestClient:
    def __init__(self, settings: Settings, access_token: str):
        if not settings.supabase_url or not settings.supabase_publishable_key:
            raise HTTPException(status_code=503, detail="Backend chưa cấu hình Supabase.")
        self.base_url = f"{settings.supabase_url.rstrip('/')}/rest/v1"
        self.headers = {
            "apikey": settings.supabase_publishable_key,
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
        }

    async def request(
        self,
        method: str,
        table: str,
        *,
        params: dict[str, str] | None = None,
        json: Any = None,
        prefer: str | None = None,
    ) -> Any:
        headers = dict(self.headers)
        if json is not None:
            headers["Content-Type"] = "application/json"
        if prefer:
            headers["Prefer"] = prefer

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.request(
                    method,
                    f"{self.base_url}/{table}",
                    headers=headers,
                    params=params,
                    json=json,
                )
        except (httpx.TimeoutException, httpx.RequestError) as exc:
            raise HTTPException(status_code=503, detail="Không liên lạc được Supabase.") from exc

        if 200 <= response.status_code < 300:
            if not response.content:
                return None
            try:
                return response.json()
            except ValueError:
                return None

        if response.status_code == 401:
            raise HTTPException(status_code=401, detail="Phiên đăng nhập không hợp lệ hoặc đã hết hạn.")
        if response.status_code == 403:
            raise HTTPException(status_code=403, detail="Bạn không có quyền truy cập dữ liệu này.")
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="Không tìm thấy dữ liệu.")
        if response.status_code == 409:
            raise HTTPException(status_code=409, detail="Dữ liệu bị trùng.")
        if response.status_code == 422:
            raise HTTPException(status_code=422, detail="Dữ liệu không hợp lệ.")
        if 400 <= response.status_code < 500:
            raise HTTPException(status_code=400, detail="Yêu cầu tới Supabase không hợp lệ.")
        raise HTTPException(status_code=503, detail="Dịch vụ dữ liệu tạm thời không khả dụng.")

    async def select(
        self,
        table: str,
        *,
        select: str,
        filters: dict[str, str] | None = None,
        order: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        params = {"select": select, **(filters or {})}
        if order:
            params["order"] = order
        if limit is not None:
            params["limit"] = str(limit)
        data = await self.request("GET", table, params=params)
        return data if isinstance(data, list) else []

    async def insert(
        self,
        table: str,
        payload: dict[str, Any],
        *,
        select: str,
        prefer: str = "return=representation",
        params: dict[str, str] | None = None,
    ) -> list[dict[str, Any]]:
        data = await self.request(
            "POST",
            table,
            params={"select": select, **(params or {})},
            json=payload,
            prefer=prefer,
        )
        return data if isinstance(data, list) else []

    async def update(
        self,
        table: str,
        payload: dict[str, Any],
        *,
        filters: dict[str, str],
        select: str,
    ) -> list[dict[str, Any]]:
        data = await self.request(
            "PATCH",
            table,
            params={"select": select, **filters},
            json=payload,
            prefer="return=representation",
        )
        return data if isinstance(data, list) else []

    async def delete(
        self,
        table: str,
        *,
        filters: dict[str, str],
        select: str = "id",
    ) -> list[dict[str, Any]]:
        data = await self.request(
            "DELETE",
            table,
            params={"select": select, **filters},
            prefer="return=representation",
        )
        return data if isinstance(data, list) else []


def get_user_supabase(
    context: AuthContext = Depends(get_auth_context),
    settings: Settings = Depends(get_settings),
) -> SupabaseRestClient:
    """PostgREST client mang JWT của user để RLS của Supabase vẫn có hiệu lực."""
    return SupabaseRestClient(settings, context.access_token)
