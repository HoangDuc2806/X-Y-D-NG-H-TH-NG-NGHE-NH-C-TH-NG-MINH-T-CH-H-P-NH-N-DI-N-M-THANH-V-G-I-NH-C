# Music Discovery Vietnam (Giai đoạn 1: khung dự án)

## Trạng thái
Đã làm và đã kiểm tra:
- Backend FastAPI: `/api/health`, CORS theo biến môi trường, log JSON, định dạng lỗi thống nhất. `pytest`: 4 test đạt.
- Frontend Next.js 14 (App Router, TypeScript strict, Tailwind): sidebar, thanh tìm kiếm, thanh phát nhạc (khung, chưa có âm thanh), 6 trang tiếng Việt. `tsc` và `next build` thành công.

CHƯA làm: Supabase/đăng nhập, kho nhạc và trình phát, Spotify, nhận diện âm thanh, gợi ý, triển khai.
Chưa kiểm tra bằng trình duyệt thật: giao diện hiển thị và việc frontend gọi backend khi chạy cùng nhau.

## Chạy backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env          # macOS/Linux: cp .env.example .env
uvicorn app.main:app --reload --port 8000
pytest
```
Mở http://localhost:8000/api/health và http://localhost:8000/docs

## Chạy frontend
```bash
cd frontend
copy .env.example .env.local    # macOS/Linux: cp .env.example .env.local
npm install
npm run dev
```
Mở http://localhost:3000. Chấm trạng thái ở trang chủ chuyển xanh khi backend đang chạy.

## Cấu trúc
backend/app/{core,routers} · backend/tests · frontend/src/{app,components,lib} · supabase/migrations · scripts

## Giai đoạn kế tiếp
Giai đoạn 2: Supabase project, migration SQL, RLS, đăng ký/đăng nhập.
