import { PageHeader, EmptyState } from "@/components/page-header";

export default function Page() {
  return (
    <>
      <PageHeader title="Nhận diện bài hát" description="Ghi âm hoặc tải lên tệp âm thanh để nhận diện." />
      <EmptyState title="Chưa có bản ghi" hint="Tính năng nhận diện sẽ có ở Giai đoạn 5." />
    </>
  );
}
