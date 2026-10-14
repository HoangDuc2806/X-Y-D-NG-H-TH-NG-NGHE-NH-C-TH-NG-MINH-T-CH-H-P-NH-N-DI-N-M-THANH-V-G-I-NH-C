import { PageHeader, EmptyState } from "@/components/page-header";

export default function Page() {
  return (
    <>
      <PageHeader title="Khám phá" description="Gợi ý bài hát tương tự trong kho nhạc được cấp phép." />
      <EmptyState title="Chưa có gợi ý" hint="Cần dữ liệu đặc trưng âm thanh ở Giai đoạn 6." />
    </>
  );
}
