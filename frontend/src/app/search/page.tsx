import { PageHeader, EmptyState } from "@/components/page-header";

export default function Page() {
  return (
    <>
      <PageHeader title="Tìm kiếm" description="Kết quả Spotify và kho nhạc được cấp phép được hiển thị riêng." />
      <EmptyState title="Chưa có kết quả" hint="Nhập từ khóa vào ô tìm kiếm phía trên. Tích hợp ở Giai đoạn 3–4." />
    </>
  );
}
