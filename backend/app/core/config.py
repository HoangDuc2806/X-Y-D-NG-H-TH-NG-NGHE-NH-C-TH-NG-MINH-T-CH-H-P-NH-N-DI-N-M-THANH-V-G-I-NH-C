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
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Supabase Auth
    supabase_url: str = ""
    supabase_publishable_key: str = ""

    # Chỉ dùng nếu sau này cần Alembic migration
    database_url: str = ""

    # Spotify catalog search (server-side only; never expose client secret to frontend).
    spotify_client_id: str = ""
    spotify_client_secret: str = ""

    # Music recognition: Chromaprint fpcalc + AcoustID public lookup API.
    acoustid_client_key: str = ""
    chromaprint_fpcalc_path: str = "fpcalc"
    recognition_max_upload_bytes: int = 20 * 1024 * 1024
    recognition_fingerprint_length_seconds: int = 120
    recognition_min_duration_seconds: int = 5
    recognition_max_duration_seconds: int = 1800

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