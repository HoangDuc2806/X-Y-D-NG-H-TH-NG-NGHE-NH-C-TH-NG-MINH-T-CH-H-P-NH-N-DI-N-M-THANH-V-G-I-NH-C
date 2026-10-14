import { PageHeader, EmptyState } from "@/components/page-header";

export default function Page() {
  return (
    <>
      <PageHeader title="Tài khoản" description="Hồ sơ, kết nối Spotify và quyền riêng tư." />
      <EmptyState title="Bạn chưa đăng nhập" hint="Đăng ký và đăng nhập sẽ có ở Giai đoạn 2." />
    </>
  );
}
