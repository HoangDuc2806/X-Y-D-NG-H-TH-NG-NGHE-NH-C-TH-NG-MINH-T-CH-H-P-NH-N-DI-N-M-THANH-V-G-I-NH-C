"""Phase 2 schema & RLS. Dùng ALEMBIC hoặc Supabase SQL Editor, không chạy cả hai.

Revision ID: 20261012_phase2
Revises:
"""
from pathlib import Path
from alembic import op
revision = "20261012_phase2"
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    sql_path = Path(__file__).resolve().parents[3] / "supabase" / "migrations" / "20261012_phase2.sql"
    # Psycopg hỗ trợ nhiều câu lệnh khi dùng DBAPI execute không tham số.
    connection = op.get_bind()
    raw = connection.connection
    with raw.cursor() as cursor:
        cursor.execute(sql_path.read_text(encoding="utf-8"))

def downgrade() -> None:
    raise RuntimeError("Không tự động downgrade: có thể làm mất tài khoản và playlist. Sao lưu rồi rollback thủ công.")
