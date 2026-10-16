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
copy .env.example .env.local
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


## GIAI ĐOẠN 3.2 — Backend Music Data API

Đã hoàn thành lớp API dữ liệu cá nhân trên FastAPI:
- `/api/profile`: đọc/cập nhật hồ sơ.
- `/api/favorites`: đọc, thêm/upsert, xóa yêu thích.
- `/api/playlists`: đọc, tạo, cập nhật, xóa playlist.
- `/api/playlists/{playlist_id}/tracks`: CRUD bài trong bảng `playlist_tracks`.
- `/api/playlists/{playlist_id}/items`: API tương thích cho bảng `playlist_items` của Phase 2.
- `/api/listening-history`: đọc, ghi, xóa lịch sử nghe.
- Bearer token được Supabase Auth xác minh trước khi xử lý.
- PostgREST được gọi bằng publishable key + access token của user để RLS tiếp tục có hiệu lực.
- Không dùng service-role key cho request người dùng và không dùng `DATABASE_URL` trong API.
- Request body không được phép tự gửi `user_id`.
- Xử lý bài hát yêu thích trùng bằng `resolution=ignore-duplicates`, không yêu cầu cấp quyền UPDATE RLS chỉ để xử lý upsert.
- Test backend hiện tại: **32 tests pass** trong môi trường kiểm thử; các dịch vụ Supabase/AcoustID được mock khi test.

Lưu ý: database hiện có cả `playlist_items` và `playlist_tracks`; Phase 3.2 không tự ý merge/xóa một trong hai và không đồng bộ hai bảng.

## GIAI ĐOẠN NHẬN DIỆN ÂM NHẠC — Chromaprint + AcoustID

Đã bổ sung luồng nhận diện âm thanh thực tế theo kiến trúc sau:

1. Người dùng đã đăng nhập, chủ động ghi âm tối đa 15 giây bằng micro hoặc tải tệp âm thanh lên trang `/identify`.
2. Frontend gửi tệp qua `POST /api/identify` kèm Bearer access token của phiên Supabase.
3. FastAPI xác thực phiên, kiểm tra định dạng/kích thước, ghi tệp vào thư mục tạm của hệ điều hành và chạy `fpcalc` để tạo dấu vân tay Chromaprint.
4. Backend gửi **dấu vân tay và thời lượng**, không gửi tệp âm thanh, tới AcoustID để tra cứu metadata MusicBrainz.
5. Backend trả về tên bài hát, nghệ sĩ, album/năm nếu có, điểm khớp và liên kết tham khảo. Tệp tạm được xóa khi xử lý xong; không có dữ liệu kết quả giả.

### Cấu hình nhận diện trên Windows

1. Đăng ký ứng dụng AcoustID tại <https://acoustid.org/new-application> để lấy `client key`. Dịch vụ web AcoustID miễn phí chỉ dành cho mục đích phi thương mại và yêu cầu giới hạn tần suất; xem <https://acoustid.org/webservice>.
2. Cài Chromaprint CLI và xác nhận lệnh `fpcalc` chạy được trong Terminal. Nếu chưa có trong `PATH`, lấy đường dẫn đầy đủ tới `fpcalc.exe`. Với tệp ghi âm WebM, cần dùng bản `fpcalc` có hỗ trợ giải mã định dạng đó; nếu không, hãy thử tải WAV/MP3.
3. Mở `backend/.env.local` và thêm các biến sau (không đưa client key vào frontend):

```dotenv
ACOUSTID_CLIENT_KEY=YOUR_ACOUSTID_CLIENT_KEY
CHROMAPRINT_FPCALC_PATH=fpcalc
RECOGNITION_MAX_UPLOAD_BYTES=20971520
RECOGNITION_FINGERPRINT_LENGTH_SECONDS=120
RECOGNITION_MIN_DURATION_SECONDS=5
RECOGNITION_MAX_DURATION_SECONDS=1800
```

Nếu `fpcalc.exe` chưa có trong `PATH`, đặt `CHROMAPRINT_FPCALC_PATH` thành đường dẫn đầy đủ, ví dụ `C:\tools\chromaprint\fpcalc.exe`. Khởi động lại FastAPI sau khi sửa cấu hình. Backend đọc `.env.local`, vì vậy hãy tạo file này từ `.env.example` nếu chưa có.

### Kiểm thử và giới hạn

- Backend: `python -m pytest -q` — **32 tests pass** tại thời điểm cập nhật tài liệu. Các test nhận diện dùng dữ liệu dịch vụ giả lập có kiểm soát để không phụ thuộc Internet hoặc API key.
- Frontend: `npm run typecheck` — **pass**. `npm run build` chưa xác minh được trong môi trường đóng gói này do thiếu gói SWC Linux và không thể tải gói từ npm registry; hãy chạy build trên máy phát triển Windows của dự án.
- API nhận diện yêu cầu đăng nhập; tệp tối đa 20 MB theo mặc định, tối thiểu 5 giây và tối đa 30 phút. Dấu vân tay chỉ lấy tối đa 120 giây đầu để giới hạn thời gian xử lý.
- AcoustID không bảo đảm tìm được mọi bài hát, đặc biệt với đoạn thu micro ngắn/nhiễu hoặc bản nhạc chưa có trong cơ sở dữ liệu. Điểm khớp là điểm của dịch vụ, không phải xác suất chắc chắn.
- Chức năng này chỉ nhận diện metadata, **không tải nhạc, không phát nhạc Spotify và không tự lưu lịch sử nghe**. Các chức năng đó cần được triển khai riêng với nguồn nhạc có quyền sử dụng hợp pháp.


## Spotify Web Playback SDK — phát nhạc trực tiếp trong website

Trang `/search` vẫn dùng Spotify Web API để tìm metadata bài hát. Phần nghe nhạc dùng **Spotify Web Playback SDK** và quyền OAuth của chính người nghe; website không tải hoặc lưu file nhạc Spotify. Người dùng phải kết nối tài khoản Spotify của mình, và Web Playback SDK yêu cầu Spotify Premium.

### Cấu hình Spotify Developer Dashboard

1. Tạo ứng dụng tại <https://developer.spotify.com/dashboard> và sao chép **Client ID**.
2. Trong app settings, thêm Redirect URI chính xác: `http://127.0.0.1:3000/spotify/callback`.
3. Trong Development Mode, thêm email tài khoản Spotify của bạn vào danh sách người dùng được phép. Tài khoản chủ ứng dụng cần Premium; Development Mode hiện giới hạn tối đa 5 người dùng được ủy quyền.
4. Nếu chạy dự án cho mục đích học tập/demo, không dùng SDK như dịch vụ streaming thương mại; cần tuân thủ Spotify Developer Policy và các giới hạn nền tảng.

### Cấu hình frontend

Thêm vào `frontend/.env.local` (Client ID là giá trị public; **không** đặt Client Secret ở frontend):

```dotenv
NEXT_PUBLIC_SPOTIFY_CLIENT_ID=YOUR_SPOTIFY_CLIENT_ID
NEXT_PUBLIC_SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/spotify/callback
```

Để callback OAuth dùng cùng origin, hãy mở website tại `http://127.0.0.1:3000` sau khi kết nối Spotify. Trong Supabase **Authentication → URL Configuration → Redirect URLs**, thêm `http://127.0.0.1:3000/**` để đăng nhập Supabase tiếp tục hoạt động trên địa chỉ này.

### Cấu hình backend

Giữ Client Secret ở `backend/.env.local`:

```dotenv
SPOTIFY_CLIENT_ID=YOUR_SPOTIFY_CLIENT_ID
SPOTIFY_CLIENT_SECRET=YOUR_SPOTIFY_CLIENT_SECRET
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Nếu `backend/.env.local` đã có `CORS_ORIGINS`, sửa dòng đó để bao gồm cả hai địa chỉ trên rồi khởi động lại FastAPI. Backend sử dụng Client Credentials để tìm bài hát; luồng phát nhạc dùng Authorization Code with PKCE từ trình duyệt, không sử dụng Client Secret ở frontend.

### Cách thử

1. Chạy backend và frontend như bình thường.
2. Mở `http://127.0.0.1:3000`, nhấn **Kết nối Spotify** và cấp quyền.
3. Tìm một bài hát trên trang **Tìm kiếm** rồi chọn **Phát trên website**. Thanh phát nhạc dưới cùng sẽ hiển thị bài hiện tại và hỗ trợ phát/tạm dừng, bài trước/sau và âm lượng.
4. Ở trang **Nhận diện**, chọn **Tìm bài này trên Spotify** để tìm bản Spotify của bài vừa nhận diện, sau đó phát từ kết quả tìm kiếm.

Nếu Spotify trả 403, kiểm tra app đang ở Development Mode, tài khoản đã được thêm allowlist, Premium còn hiệu lực và các quyền đã được cấp. Người khác không thể dùng Premium của bạn: mỗi người nghe cần tự kết nối tài khoản Spotify của họ và phải được cho phép trong Development Mode.

### Lưu ý quan trọng

- Access token và refresh token được lưu trong `sessionStorage` của tab trình duyệt và có thể cần kết nối lại khi phiên hết hạn hoặc tab bị đóng.
- Phát nhạc yêu cầu tài khoản Spotify Premium của người đang kết nối, trình duyệt hỗ trợ Encrypted Media Extensions và quyền phát của Spotify.
- Spotify Developer Mode phù hợp cho phát triển cá nhân/phi thương mại; không nên coi đó là cách triển khai cho lượng người dùng công khai lớn. Spotify hiện nêu giới hạn 5 người dùng được ủy quyền trong Development Mode.
- Không sử dụng Spotify audio/metadata để huấn luyện mô hình AI. Chức năng nhận diện hiện tại lấy fingerprint từ âm thanh do người dùng ghi/tải lên, rồi tìm metadata Spotify riêng biệt.

Tài liệu chính thức:
- Web Playback SDK: <https://developer.spotify.com/documentation/web-playback-sdk>
- Authorization Code with PKCE: <https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow>
- Redirect URI: <https://developer.spotify.com/documentation/web-api/concepts/redirect_uri>
- Development Mode / quota modes: <https://developer.spotify.com/documentation/web-api/concepts/quota-modes>
