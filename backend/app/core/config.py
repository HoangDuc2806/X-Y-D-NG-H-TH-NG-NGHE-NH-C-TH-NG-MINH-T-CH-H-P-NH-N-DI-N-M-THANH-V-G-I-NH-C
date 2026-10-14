from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env.local",
        extra="ignore"
    )

    app_name: str = "Music Discovery Vietnam API"
    environment: str = "development"
    log_level: str = "INFO"
    cors_origins: str = "http://localhost:3000"

    # Supabase Auth
    supabase_url: str = ""
    supabase_publishable_key: str = ""

    # Chỉ dùng nếu sau này cần Alembic migration
    database_url: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [
            o.strip()
            for o in self.cors_origins.split(",")
            if o.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()