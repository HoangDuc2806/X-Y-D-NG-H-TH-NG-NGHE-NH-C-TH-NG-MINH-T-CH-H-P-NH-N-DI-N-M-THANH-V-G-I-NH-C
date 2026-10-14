# Kiến trúc phân quyền — Giai đoạn 2

## Luồng phiên

1. Trình duyệt đăng nhập bằng Supabase JS. Supabase Auth cấp session.
2. Trình duyệt dùng **publishable key** để gọi PostgREST; thư viện gửi access token của user; PostgreSQL thực thi RLS theo `auth.uid()`.
3. Khi kiểm tra qua FastAPI `/api/me`, frontend gửi access token qua `Authorization: Bearer ...`. Backend gửi token đó đến Supabase Auth `GET /auth/v1/user`. Chỉ khi dịch vụ Auth xác nhận thì backend mới tin ID user.
4. Backend không dùng `service_role` cho các truy vấn dữ liệu riêng tư, tránh bỏ qua RLS.

## Bảng và quyền

| Bảng | Đọc | Thêm | Cập nhật | Xóa |
|---|---|---|---|---|
| profiles | Chỉ bản thân | Chỉ bản thân / trigger | Chỉ `display_name` | Chỉ bản thân |
| playlists | Chỉ chủ sở hữu | Chỉ chủ sở hữu | Chỉ `name`, `description` | Chỉ chủ sở hữu |
| playlist_items | Chỉ chủ sở hữu | Chỉ chủ sở hữu và playlist thuộc mình | Chỉ `position` | Chỉ chủ sở hữu |
| favorites | Chỉ bản thân | Chỉ bản thân | Không cấp | Chỉ bản thân |
| listening_history | Chỉ bản thân | Chỉ bản thân | Không cấp | Chỉ bản thân |

`playlist_items` có FK ghép `(playlist_id,user_id)` → `playlists(id,user_id)` nên không thể gắn bài vào playlist của người khác chỉ bằng cách giả mạo playlist ID.

**Chưa triển khai end-to-end:** chưa có Supabase project thật để thử hai người dùng, chưa có luồng upload âm thanh, chưa có frontend verified production build. Khi đưa lên production, cần E2E tests, rate limits, cấu hình SMTP xác nhận email, audit Storage RLS, SSL và domain redirect.
