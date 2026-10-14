"use client";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { useAuth } from "@/components/providers";
export function UserMenu() {
  const { user,loading,configured } = useAuth();
  if (!configured || loading) return null;
  return <Link href={user ? "/settings" : "/auth/login"} className="inline-flex items-center gap-2 rounded-full border border-ink-700 bg-ink-800 px-3 py-2 text-xs text-mist-100 hover:border-lime-500"><UserRound size={16}/><span className="hidden sm:inline">{user ? (user.email ?? "Tài khoản") : "Đăng nhập"}</span></Link>;
}
