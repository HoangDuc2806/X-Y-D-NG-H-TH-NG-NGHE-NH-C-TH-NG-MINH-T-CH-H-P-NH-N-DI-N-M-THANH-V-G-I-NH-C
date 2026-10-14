import os
from logging.config import fileConfig
from alembic import context
from sqlalchemy import create_engine, pool
from app.models import Base
from app.core.config import get_settings

config = context.config
target_metadata = Base.metadata

def run_migrations_online() -> None:
    url = os.environ.get("DATABASE_URL") or get_settings().database_url
    if not url:
        raise RuntimeError("Thiếu DATABASE_URL. Hãy thiết lập URI Postgres khi quản trị migration.")
    engine = create_engine(url, poolclass=pool.NullPool)
    try:
        with engine.connect() as connection:
            context.configure(connection=connection, target_metadata=target_metadata, include_schemas=True)
            with context.begin_transaction():
                context.run_migrations()
    finally:
        engine.dispose()

run_migrations_online()
