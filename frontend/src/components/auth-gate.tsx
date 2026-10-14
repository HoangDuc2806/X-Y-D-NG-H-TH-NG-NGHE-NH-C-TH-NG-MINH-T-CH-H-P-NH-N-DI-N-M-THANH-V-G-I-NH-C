"use client";
import Link from "next/link";
import { useAuth } from "@/components/providers";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, configured } = useAuth();
  if (!configured) return <div className="rounded-2xl border border-amber-700/50 bg-amber-900/10 p-6 text-sm text-amber-100">Chưa cấu hình Supabase. Hãy sao chép <code>frontend/.env.example</code> thành <code>frontend/.env.local</code> và điền URL cùng publishable key của dự án.</div>;
  if (loading) return <div role="status" className="rounded-2xl border border-ink-700 p-6 text-mist-300">Đang kiểm tra phiên đăng nhập…</div>;
  if (!user) return <div className="rounded-2xl border border-ink-700 bg-ink-900 p-8"><h2 className="text-xl font-semibold">Bạn chưa đăng nhập</h2><p className="mt-2 text-sm text-mist-300">Đăng nhập để lưu và quản lý dữ liệu cá nhân. Mỗi tài khoản chỉ thấy dữ liệu của mình.</p><div className="mt-5 flex gap-3"><Link href="/auth/login" className="rounded-full bg-lime-400 px-5 py-2 font-semibold text-ink-950">Đăng nhập</Link><Link href="/auth/register" className="rounded-full border border-ink-700 px-5 py-2">Tạo tài khoản</Link></div></div>;
  return <>{children}</>;
}
