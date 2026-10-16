# BÁO CÁO TIẾN ĐỘ — MUSIC DISCOVERY VIETNAM

## 1. Mục tiêu

Bổ sung chức năng nhận diện bài hát từ âm thanh người dùng chủ động ghi bằng micro hoặc tải lên, đồng thời giữ nguyên cơ chế xác thực Supabase và các API dữ liệu cá nhân đã triển khai.

## 2. Các phần đã có trong source code

- Supabase Auth xác thực người dùng; API cá nhân sử dụng Bearer access token.
- FastAPI Music Data API cho hồ sơ, bài hát yêu thích, playlist, bài trong playlist và lịch sử nghe.
- Endpoint `POST /api/identify` nhận tệp âm thanh đã được kiểm tra định dạng và dung lượng.
- Chromaprint `fpcalc` tạo dấu vân tay âm thanh.
- AcoustID tra cứu dấu vân tay và trả metadata từ MusicBrainz khi có kết quả.
- Trang Next.js `/identify` hỗ trợ ghi âm tối đa 15 giây, tải tệp, hiển thị kết quả và điểm khớp.
- Tệp âm thanh chỉ được ghi vào thư mục tạm của backend trong thời gian xử lý và được xóa sau đó.
- Xử lý bài hát yêu thích trùng mà không yêu cầu cấp quyền UPDATE RLS rộng hơn cần thiết.

## 3. Luồng xử lý

1. Người dùng đăng nhập và mở trang Nhận diện.
2. Người dùng cấp quyền micro và ghi âm, hoặc chọn tệp âm thanh.
3. Frontend gửi tệp tới `POST /api/identify` cùng Bearer token.
4. Backend xác thực phiên Supabase, kiểm tra tệp và tạo tệp tạm.
5. `fpcalc` tạo fingerprint; backend gửi fingerprint cùng thời lượng tới AcoustID.
6. Backend chuẩn hóa kết quả thành tên bài hát, nghệ sĩ, album/năm nếu có, điểm khớp và liên kết MusicBrainz/AcoustID.
7. Backend trả kết quả cho frontend và xóa tệp tạm. Nếu không có kết quả, giao diện thông báo rõ thay vì dựng dữ liệu giả.

## 4. Kiểm thử đã thực hiện

- Backend: `python -m pytest -q` — **32 tests passed**.
- Frontend: `npm run typecheck` — **passed**.
- Các test API nhận diện dùng mock cho `fpcalc` và AcoustID để kiểm tra luồng xử lý, xác thực, tệp không hợp lệ, giới hạn dung lượng, âm thanh quá ngắn, kết quả khớp và không khớp.
- `npm run build` chưa được xác minh trong môi trường đóng gói do thiếu gói SWC tương thích Linux và môi trường không thể tải gói từ npm registry.

## 5. Việc cần cấu hình để demo nhận diện trực tiếp

- Đăng ký AcoustID client key.
- Cài Chromaprint CLI và xác nhận `fpcalc` chạy được trên máy Windows.
- Thêm `ACOUSTID_CLIENT_KEY` và `CHROMAPRINT_FPCALC_PATH` vào `backend/.env.local`, sau đó khởi động lại FastAPI.
- Đăng nhập trên website, mở `/identify`, ghi âm một đoạn nhạc rõ 10–15 giây hoặc tải MP3/WAV lên và chạy nhận diện.

## 6. Giới hạn hiện tại

- Kết quả nhận diện trực tiếp phụ thuộc vào API key, khả năng chạy `fpcalc`, kết nối Internet và dữ liệu có trong cơ sở dữ liệu AcoustID/MusicBrainz. Những thành phần bên ngoài chưa được xác minh end-to-end trong môi trường kiểm thử này.
- AcoustID có thể không nhận ra bài hát chưa có trong cơ sở dữ liệu hoặc đoạn thu quá ngắn/nhiễu; điểm khớp không phải xác suất chắc chắn.
- Tính năng hiện nhận diện metadata, không phát nhạc, không tải nhạc Spotify và không tự ghi lịch sử nghe.
- Dịch vụ web AcoustID miễn phí dành cho mục đích phi thương mại; cần tuân thủ điều khoản và giới hạn tần suất của dịch vụ.


## Bổ sung tích hợp Spotify

- Thêm `GET /api/spotify/search` sử dụng Spotify Client Credentials flow phía backend.
- Thêm giao diện tìm kiếm danh mục Spotify ở `/search`, có ảnh bìa, tên bài, nghệ sĩ, thời lượng, liên kết mở Spotify và Spotify Embed.
- Trang nhận diện `/identify` có liên kết tìm kết quả nhận diện trên Spotify.
- Cần cấu hình `SPOTIFY_CLIENT_ID` và `SPOTIFY_CLIENT_SECRET` trong `backend/.env.local`; không đưa secret vào frontend.
- Đã bổ sung test route Spotify bằng mock; cần chạy lại `python -m pytest -q` và `npm run typecheck` trên máy phát triển. Chưa thể xác minh kết nối Spotify thực tế nếu chưa có credentials hợp lệ.
