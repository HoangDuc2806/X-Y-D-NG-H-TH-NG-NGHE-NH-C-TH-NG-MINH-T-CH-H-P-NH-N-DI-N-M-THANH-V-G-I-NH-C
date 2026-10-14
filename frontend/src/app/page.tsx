import { PageHeader, EmptyState } from "@/components/page-header";
import { BackendStatus } from "@/components/backend-status";

export default function HomePage() {
  return (
    <>
      <PageHeader title="Xin chào" description="Nghe nhạc trong kho nhạc được cấp phép, nhận diện bài hát và mở bản gốc trên Spotify." />
      <div className="mb-8"><BackendStatus /></div>
      <EmptyState title="Chưa có bài hát nào trong kho nhạc" hint="Kho nhạc được cấp phép sẽ xuất hiện ở đây sau Giai đoạn 3." />
    </>
  );
}
