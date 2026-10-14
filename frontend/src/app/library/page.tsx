import { PageHeader, EmptyState } from "@/components/page-header";

export default function Page() {
  return (
    <>
      <PageHeader title="Thư viện" description="Bài hát yêu thích, playlist và lịch sử nghe." />
      <EmptyState title="Thư viện đang trống" hint="Đăng nhập (Giai đoạn 2) để lưu bài hát yêu thích." />
    </>
  );
}
