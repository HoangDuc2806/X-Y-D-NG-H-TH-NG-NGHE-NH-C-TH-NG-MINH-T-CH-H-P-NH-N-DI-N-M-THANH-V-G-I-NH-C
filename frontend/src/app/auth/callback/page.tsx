"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

export default function AuthCallback() {
  const router=useRouter();const [message,setMessage]=useState("Đang xác minh liên kết đăng ký…");
  useEffect(()=>{
    const supabase=getSupabaseClient();
    if (!supabase) {setMessage("Chưa cấu hình Supabase.");return;}
    let active=true;
    const run=async()=>{
      try{
        const params=new URLSearchParams(window.location.search);
        const linkError=params.get("error_description");
        if (linkError) throw new Error(linkError);
        const code=params.get("code");
        if (code) {const {data: existing}=await supabase.auth.getSession();if(!existing.session){const {error}=await supabase.auth.exchangeCodeForSession(code);if(error)throw error;}}
        // Với implicit flow, getUser() đợi Supabase JS tự xử lý URL fragment.
        const {data,error}=await supabase.auth.getUser();
        if(error)throw error;
        if(!data.user) throw new Error("Phiên xác nhận không tồn tại hoặc đã hết hạn.");
        if(active)router.replace("/settings");
      }catch(e){if(active)setMessage(e instanceof Error?e.message:"Xác minh không thành công.");}
    };
    void run();return()=>{active=false;};
  },[router]);
  return <div className="mx-auto max-w-lg rounded-2xl border border-ink-700 bg-ink-900 p-8"><h1 className="text-2xl font-bold">Xác nhận tài khoản</h1><p role="status" className="mt-3 text-mist-300">{message}</p><Link href="/auth/login" className="mt-5 inline-block text-lime-400 hover:underline">Về trang đăng nhập</Link></div>;
}
