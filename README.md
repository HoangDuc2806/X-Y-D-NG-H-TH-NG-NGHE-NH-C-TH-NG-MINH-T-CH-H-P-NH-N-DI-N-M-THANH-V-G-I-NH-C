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

# MUSIC DISCOVERY VIETNAM — GIAI ĐOẠN 2

**Next.js 14 App Router + TypeScript strict + Tailwind CSS + Supabase Auth/PostgreSQL/RLS + FastAPI.**
Dự án phát triển trực tiếp từ ZIP Giai đoạn 1, giữ nguyên các trang và giao diện ban đầu.

## Có thể sử dụng sau khi kết nối Supabase thật

- Đăng ký email/mật khẩu (xác nhận email tùy thiết lập Supabase), đăng nhập, đăng xuất.
- Yêu cầu email đặt lại mật khẩu; mở liên kết để cập nhật mật khẩu.
- Trang tài khoản: đọc/lưu tên hiển thị từ `public.profiles`.
- Trang thư viện: tạo, xem, đổi tên, xóa playlist trong PostgreSQL.
- Đọc yêu thích và lịch sử thực từ Supabase (đang rỗng vì chưa có bài hát/phát nhạc); thiết kế hàm API lưu/bỏ yêu thích và thêm bài hát playlist cho các giai đoạn sau.
- Bộ bảng SQL + RLS hạn chế mỗi người dùng chỉ được đọc/ghi dữ liệu thuộc tài khoản mình.
- Supabase Storage bucket `user-audio` riêng tư, giới hạn 25 MB và chính sách path theo UID. Chưa có chức năng upload UI.
- FastAPI: `/api/health` và `/api/me` bảo vệ bằng Supabase Auth; `pytest` kiểm thử.
- SQLAlchemy 2 models và một revision Alembic dùng cùng migration SQL; **chỉ dùng MỘT cách migrate.**

**KHÔNG có trong Giai đoạn 2:** Spotify API, nhận diện bằng Chromaprint, kho nhạc có giấy phép, trình phát thực, danh sách bài hát demo, AI gợi ý. Các trang này vẫn là khung từ Giai đoạn 1.

## BƯỚC 1 — Tạo Supabase project

1. Đăng nhập <https://supabase.com/dashboard>, tạo project mới và chờ Postgres sẵn sàng.
2. Trong **Project Settings / Connect** hoặc **API Keys**, sao chép **Project URL** và **Publishable key** (`sb_publishable_...`). Nếu Supabase project cũ chưa có publishable key, có thể dùng legacy `anon` key.
3. Vào **Authentication → Providers → Email**, bật Email (đăng ký mật khẩu). Bật Confirm email để yêu cầu xác nhận email, nếu muốn. Với email confirmation, thường cần mail SMTP riêng khi đưa lên sản xuất.
4. Trong **Authentication → URL Configuration**, đặt **Site URL** = `http://localhost:3000`; thêm **Redirect URLs**:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/auth/update-password`
5. Tại **SQL Editor**, tạo query mới và chạy toàn bộ `supabase/migrations/20261012_phase2.sql` **một lần trên project mới**. Query tạo 5 bảng, trigger tự tạo profile, 18 chính sách RLS cho bảng và 3 chính sách Storage.
6. Trong **Table Editor**, xác nhận các bảng `profiles`, `playlists`, `playlist_items`, `favorites`, `listening_history`. Chọn từng bảng để kiểm tra RLS đã bật.

> **Không chạy lại** file SQL qua SQL Editor sau khi đã áp dụng thành công vì các `CREATE POLICY` không có `IF NOT EXISTS`. Nếu lỗi giữa chừng, xem kết quả trước khi áp dụng lại. Có thể quản lý bằng Supabase CLI trong những giai đoạn kế tiếp.

## BƯỚC 2 — Chạy frontend (Terminal 1 trong VS Code)

```powershell
cd frontend
copy .env.example .env.local
```

Sửa `frontend/.env.local` như sau (điền giá trị của **dự án bạn**, không gõ ký tự minh họa):

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

**Tuyệt đối KHÔNG đưa** `service_role`/secret key/chuỗi kết nối Postgres vào file frontend hoặc biến `NEXT_PUBLIC_`.

```powershell
npm install
npm run typecheck
npm run dev
```

Mở <http://localhost:3000>. **Lưu ý:** Giai đoạn này bổ sung thư viện `@supabase/supabase-js`. File `package-lock.json` của phase 1 được loại bỏ vì môi trường đóng gói không truy cập được npm registry; `npm install` sẽ tạo khóa mới trên máy của bạn (cần có Internet). Để triển khai bằng `npm ci` ở lần sau, hãy lưu/commit file khóa vừa được tạo.

## BƯỚC 3 — Chạy backend (Terminal 2 trong VS Code)

Tạo `.env` từ file mẫu, sửa project URL và publishable key **giống frontend**.

```powershell
cd backend
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
copy .env.example .env
python -m uvicorn app.main:app --reload --port 8000
```

Nếu PowerShell chặn `Activate.ps1`, dùng Command Prompt và `.venv\Scripts\activate.bat`, hoặc chạy `.venv\Scripts\python.exe -m uvicorn ...` mà không cần activate. Trên macOS/Linux dùng `python3 -m venv .venv`, `source .venv/bin/activate`, `cp ...`.

- API health: <http://localhost:8000/api/health>
- Swagger: <http://localhost:8000/docs>
- API `/api/me` không token → **401**, token không hợp lệ → **401**, chưa cấu hình Supabase → **503**, token thật → thông tin ID/email chủ tài khoản.

Chạy test:

```powershell
python -m pytest -q
```

## BƯỚC 4 — Kiểm tra chức năng thật trên UI

1. Mở `/auth/register` → nhập email, tên, mật khẩu (>= 8 ký tự). Nếu bật Confirm email, mở email xác nhận; kết quả phụ thuộc Supabase và cài đặt SMTP. Không tạo profile mẫu.
2. Mở `/auth/login` → đăng nhập → tự chuyển sang `/library`.
3. Mở `/settings` → đổi tên hiển thị, Lưu. Refresh lại: dữ liệu vẫn còn trong Supabase.
4. Chọn **Kiểm tra xác thực backend** trên `/settings` → phải hiển thị User ID được FastAPI xác thực.
5. Mở `/library` → tạo 2 playlist, reload, đổi tên một playlist, xóa một playlist; vào Table Editor để so với dữ liệu thật.
6. Đăng xuất → trở lại trang đăng nhập. Mở tab ẩn danh hoặc trình duyệt khác để tạo **tài khoản B**. B không được nhìn thấy playlist của A.
7. Kiểm tra `/auth/forgot-password` qua email → liên kết → `/auth/update-password`; cần cấu hình redirect/SMTP đúng.

### Kiểm tra RLS quan trọng (2 tài khoản A và B)

Đăng nhập bằng B, mở DevTools Console và truy vấn với **client đang đăng nhập trong ứng dụng** hoặc thử gọi PostgREST bằng access token B. Khi `.select('*')` từ `playlists`, chỉ có playlist thuộc B. Thử `.insert({user_id:'UUID_CUA_A', name:'Thử vượt quyền'})` từ B phải bị RLS từ chối. Đừng kiểm tra bằng `service_role` vì khóa đó bỏ qua RLS.

Kiểm tra không cần email: gọi `GET /api/me` không token phải 401; middleware không đọc JWT chưa xác thực để tạo user giả.

## Phương án thay thế: migration qua Alembic (dành cho người có kinh nghiệm)

File SQL trong `supabase/migrations` là nguồn chung. Nếu **chưa chạy SQL Editor**, có thể đặt `DATABASE_URL` ở `backend/.env` và thực thi:

```powershell
cd backend
python -m alembic upgrade head
```

Cần dùng Postgres connection URI hợp lệ, dạng `postgresql+psycopg://...` và **quyền quản trị schema**; không dùng chuỗi kết nối này trong Next.js hay trong API xử lý người dùng.
Nếu **đã chạy SQL Editor** thì **không chạy `upgrade head`** trên cùng schema; muốn quản lý các revision sau này cần `python -m alembic stamp 20261012_phase2` để đánh dấu migration đã áp dụng. Nên sao lưu DB trước khi thử migration production.

## Cấu trúc mới

```text
music-discovery-vn/
├─ frontend/src/app/auth/              đăng ký, đăng nhập, recovery, callback
├─ frontend/src/app/settings/           tài khoản + thử xác thực backend
├─ frontend/src/app/library/            playlist + dữ liệu yêu thích/lịch sử
├─ frontend/src/components/providers.tsx   Auth context + TanStack Query
├─ frontend/src/lib/supabase.ts         Supabase browser client
├─ frontend/src/lib/data.ts             data access RLS
├─ backend/app/core/auth.py             Supabase token validation
├─ backend/app/routers/account.py       GET /api/me
├─ backend/app/models.py                SQLAlchemy models
├─ backend/alembic/                     revision migration
├─ backend/tests/                       kiểm thử API
└─ supabase/migrations/20261012_phase2.sql
```

## Thông tin kiểm thử trước khi bàn giao

- `python -m pytest -q`: **12 bài kiểm thử đạt** trên môi trường dựng file (các tình huống xác thực Supabase được **mock**, không có Supabase project thật).
- Kiểm tra cú pháp TypeScript/TSX bằng TypeScript parser: **đạt**; **chưa thể chạy `npm install`, `npm run typecheck`, `next build` hoặc thử luồng thực với Supabase**, vì môi trường không truy cập được npm registry và không có credentials Supabase.
- Trang tìm kiếm Spotify, nhận diện và phát nhạc **chưa được tích hợp**. Không hiển thị dữ liệu hoặc lượt nghe giả.

## Lộ trình tiếp

**Giai đoạn 3:** danh mục nhạc có quyền phát hợp pháp, upload qua quyền người dùng (không mặc định ghi âm tự động), HTML5 Audio, ghi lịch sử nghe thực và thêm bài vào playlist/yêu thích.
