"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, ShieldCheck, LogOut, UserRound, Server } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/components/providers";
import { getProfile, setDisplayName } from "@/lib/data";
import { requireSupabase } from "@/lib/supabase";
import { verifyBackendSession } from "@/lib/backend-auth";

const schema = z.object({ displayName:z.string().trim().min(1,"Vui lòng nhập tên.").max(80,"Tên tối đa 80 ký tự.") });
type Values = z.infer<typeof schema>;
const panel="rounded-2xl border border-ink-700 bg-ink-900 p-6";

function AccountContent() {
  const {user}=useAuth();const router=useRouter();const queryClient=useQueryClient();
  const [message,setMessage]=useState("");const [error,setError]=useState("");const [checking,setChecking]=useState(false);const [apiMessage,setApiMessage]=useState("");
  const [signingOut,setSigningOut]=useState(false);
  const profile=useQuery({queryKey:["profile",user?.id],queryFn:()=>getProfile(user!.id),enabled:Boolean(user)});
  const {register,handleSubmit,reset,formState:{errors,isSubmitting}}=useForm<Values>({resolver:zodResolver(schema),defaultValues:{displayName:""}});
  useEffect(()=>{if(profile.data)reset({displayName:profile.data.display_name});},[profile.data,reset]);
  if(!user)return null;
  async function onSave(values:Values) {
    setError("");setMessage("");
    try {await setDisplayName(user!.id,values.displayName);await queryClient.invalidateQueries({queryKey:["profile",user!.id]});setMessage("Đã lưu hồ sơ vào Supabase.");}
    catch(e){setError(e instanceof Error?e.message:"Không thể lưu hồ sơ.");}
  }
  async function onVerify(){setChecking(true);setApiMessage("");try{const {data,error:e}=await requireSupabase().auth.getSession();if(e)throw e;if(!data.session)throw new Error("Không còn phiên đăng nhập.");const result=await verifyBackendSession(data.session.access_token);setApiMessage(`FastAPI xác thực thành công. User ID: ${result.id}`);}catch(e){setApiMessage(e instanceof Error?e.message:"Xác thực thất bại.");}finally{setChecking(false);}}
  async function onSignOut(){setSigningOut(true);setError("");try{const {error:e}=await requireSupabase().auth.signOut();if(e)throw e;queryClient.clear();router.replace("/auth/login");router.refresh();}catch(e){setError(e instanceof Error?e.message:"Đăng xuất không thành công.");}finally{setSigningOut(false);}}
  return <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
    <section className={panel}><div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-lime-400/10 p-3 text-lime-400"><UserRound/></div><div><h2 className="text-xl font-bold">Thông tin tài khoản</h2><p className="text-xs text-mist-300">Bảo vệ bằng Supabase Auth và RLS</p></div></div>
      <div className="mb-5 rounded-xl bg-ink-800 p-4"><p className="text-xs uppercase tracking-widest text-mist-300">Email đăng nhập</p><p className="mt-1 break-all font-medium">{user.email ?? "Không có email"}</p><p className="mt-2 break-all text-xs text-mist-300">ID: {user.id}</p></div>
      <form onSubmit={handleSubmit(onSave)} className="space-y-3"><label htmlFor="profile-name" className="block text-sm font-medium">Tên hiển thị</label><input id="profile-name" maxLength={80} aria-invalid={Boolean(errors.displayName)} className="w-full rounded-xl border border-ink-700 bg-ink-950 px-4 py-3 focus:border-lime-400 focus:outline-none" {...register("displayName")}/>{errors.displayName && <p role="alert" className="text-sm text-red-300">{errors.displayName.message}</p>}
        {profile.isError && <p role="alert" className="text-sm text-red-300">{profile.error.message}</p>}
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}{message && <p role="status" className="flex items-center gap-2 text-sm text-lime-400"><CheckCircle2 size={16}/>{message}</p>}
        <button disabled={isSubmitting||profile.isLoading} className="rounded-xl bg-lime-400 px-5 py-2.5 font-semibold text-ink-950 disabled:opacity-60">{isSubmitting?"Đang lưu…":"Lưu hồ sơ"}</button></form>
    </section>
    <div className="space-y-5"><section className={panel}><h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><ShieldCheck size={20} className="text-lime-400"/> Quyền riêng tư</h2><p className="text-sm leading-relaxed text-mist-300">Playlist, yêu thích và lịch sử nghe được phân quyền theo ID người dùng ở PostgreSQL. Người dùng khác không thể xem hoặc sửa dữ liệu của bạn qua API thông thường.</p><Link className="mt-4 inline-block text-sm font-medium text-lime-400 hover:underline" href="/auth/update-password">Đổi mật khẩu</Link></section>
      <section className={panel}><h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Server size={20} className="text-lime-400"/> Kiểm tra FastAPI</h2><p className="mb-4 text-sm text-mist-300">Gửi token phiên hiện tại tới <code>/api/me</code>. Backend hỏi Supabase Auth trước khi xác nhận.</p><button type="button" onClick={()=>void onVerify()} disabled={checking} className="rounded-xl border border-ink-700 px-4 py-2 text-sm hover:border-lime-400 disabled:opacity-60">{checking?"Đang kiểm tra…":"Kiểm tra xác thực backend"}</button>{apiMessage && <p role="status" className="mt-3 break-words text-xs text-mist-300">{apiMessage}</p>}</section>
      <button type="button" disabled={signingOut} onClick={()=>void onSignOut()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-900/80 px-4 py-3 text-sm text-red-300 hover:bg-red-950/30 disabled:opacity-60"><LogOut size={18}/>{signingOut?"Đang đăng xuất…":"Đăng xuất"}</button>
    </div>
  </div>;
}
export default function Page(){return <><PageHeader title="Tài khoản" description="Quản lý hồ sơ và xác minh phiên đăng nhập thực tế qua Supabase."/><AuthGate><AccountContent/></AuthGate></>}
