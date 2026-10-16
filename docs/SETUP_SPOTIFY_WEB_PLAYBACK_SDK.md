# Cấu hình Spotify Web Playback SDK cho Music Discovery Vietnam

Tài liệu này dùng cho bản demo học tập/chạy local. Web Playback SDK yêu cầu người nghe tự cấp quyền Spotify và tài khoản Premium.

## 1. Tạo ứng dụng Spotify

1. Mở https://developer.spotify.com/dashboard và tạo/chọn app.
2. Sao chép **Client ID**.
3. Trong app settings, thêm Redirect URI chính xác:

   `http://127.0.0.1:3000/spotify/callback`

4. Trong Development Mode, thêm email của tài khoản Spotify đang dùng vào danh sách người dùng được phép. Tài khoản chủ ứng dụng cần Spotify Premium.

## 2. Cấu hình frontend

Mở `frontend/.env.local` và thêm:

```dotenv
NEXT_PUBLIC_SPOTIFY_CLIENT_ID=YOUR_SPOTIFY_CLIENT_ID
NEXT_PUBLIC_SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/spotify/callback
```

Client ID không phải secret. **Không** thêm Client Secret vào frontend hoặc biến `NEXT_PUBLIC_`.

## 3. Cấu hình backend

Mở `backend/.env.local` và giữ Client Secret ở backend:

```dotenv
SPOTIFY_CLIENT_ID=YOUR_SPOTIFY_CLIENT_ID
SPOTIFY_CLIENT_SECRET=YOUR_SPOTIFY_CLIENT_SECRET
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Nếu đã có `CORS_ORIGINS`, sửa để bao gồm cả hai origin rồi khởi động lại FastAPI.

## 4. Cho phép origin trong Supabase

Trong Supabase Dashboard → Authentication → URL Configuration → Redirect URLs, thêm:

`http://127.0.0.1:3000/**`

Website dùng `localhost` và `127.0.0.1` là hai origin riêng trong trình duyệt. Sau khi kết nối Spotify, tiếp tục dùng `http://127.0.0.1:3000` và đăng nhập Supabase lại tại origin này nếu cần.

## 5. Chạy thử

Chạy backend và frontend trong hai terminal:

```powershell
# Terminal backend
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

```powershell
# Terminal frontend
cd frontend
npm run typecheck
npm run dev
```

Mở `http://127.0.0.1:3000`, nhấn **Kết nối Spotify**, cấp quyền, tìm một bài hát ở `/search` và nhấn **Phát trên website**. Thanh dưới cùng hỗ trợ phát/tạm dừng, bài trước/sau và âm lượng.

## Lưu ý

- Spotify Development Mode giới hạn người dùng được ủy quyền; người nghe khác phải được thêm vào allowlist và tự cấp quyền tài khoản của họ. Premium của chủ app không cho phép phát nhạc bằng tài khoản của người khác.
- Access/refresh token được lưu trong `sessionStorage` của tab để SDK dùng trong phiên hiện tại. Không chia sẻ token hoặc đưa chúng vào mã nguồn.
- Nếu phát nhạc trả 403, kiểm tra allowlist, Premium, scope đã cấp và quyền truy cập endpoint trong Spotify Developer Dashboard.
- Spotify Developer Policy hạn chế streaming integration thương mại và không cho phép sử dụng Spotify Content để huấn luyện AI. Dự án nhận diện âm nhạc chỉ nên dùng âm thanh người dùng chủ động ghi/tải lên để tạo fingerprint; sau đó mới tìm metadata tương ứng trên Spotify.
