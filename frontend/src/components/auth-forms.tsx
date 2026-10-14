"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode, type InputHTMLAttributes } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LockKeyhole, Mail, Music2, UserRound } from "lucide-react";
import { requireSupabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers";

const emailValidator = z.string().trim().email("Email không hợp lệ.").max(254);
const passwordValidator = z.string().min(8,"Mật khẩu phải có ít nhất 8 ký tự.").max(72,"Mật khẩu quá dài.");
const loginSchema = z.object({ email: emailValidator, password: z.string().min(1,"Hãy nhập mật khẩu.") });
const registerSchema = z.object({ displayName:z.string().trim().min(1,"Hãy nhập tên hiển thị.").max(80), email:emailValidator, password:passwordValidator, confirmPassword:z.string() }).refine((v)=>v.password===v.confirmPassword,{path:["confirmPassword"],message:"Hai mật khẩu chưa trùng khớp."});
const forgotSchema = z.object({ email: emailValidator });
const updateSchema = z.object({ password:passwordValidator,confirmPassword:z.string() }).refine(v=>v.password===v.confirmPassword,{path:["confirmPassword"],message:"Hai mật khẩu chưa trùng khớp."});

const inputStyle = "w-full rounded-xl border border-ink-700 bg-ink-950 px-4 py-3 text-sm text-mist-100 outline-none focus:border-lime-400";
const btnStyle = "w-full rounded-xl bg-lime-400 px-4 py-3 font-semibold text-ink-950 transition hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-50";

function Frame({ icon, title, description, children }: {icon:ReactNode; title:string;description:string;children:ReactNode}) {
  return <div className="mx-auto max-w-md py-3 md:py-8"><div className="rounded-3xl border border-ink-700 bg-ink-900 p-6 shadow-xl shadow-black/20 sm:p-8"><div className="mb-5 inline-flex rounded-2xl bg-lime-400/10 p-3 text-lime-400">{icon}</div><h1 className="text-3xl font-bold tracking-tight">{title}</h1><p className="mt-2 mb-7 text-sm leading-relaxed text-mist-300">{description}</p>{children}</div></div>;
}
function Feedback({ error, success }: {error:string;success:string}) { return <>{error && <p role="alert" className="my-3 rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-200">{error}</p>}{success && <p role="status" className="my-3 rounded-lg border border-lime-600/30 bg-lime-400/10 p-3 text-sm text-lime-400">{success}</p>}</>; }
function Field({label,id,error, ...inputProps}:{label:string;id:string;error?:string}&InputHTMLAttributes<HTMLInputElement>){return <div><label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label><input id={id} className={inputStyle} aria-invalid={Boolean(error)} aria-describedby={error?`${id}-error`:undefined} {...inputProps}/>{error && <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-red-300">{error}</p>}</div>;}

export function LoginForm() {
  const { configured } = useAuth(); const router=useRouter();
  const [error,setError]=useState("");
  const {register,handleSubmit,formState:{errors,isSubmitting}}=useForm<z.infer<typeof loginSchema>>({resolver:zodResolver(loginSchema)});
  return <Frame icon={<LockKeyhole size={26}/>} title="Mừng bạn trở lại" description="Đăng nhập để lưu playlist, bài hát yêu thích và quản lý thư viện riêng tư.">
    {!configured && <Feedback error="Chưa cấu hình Supabase. Hãy kiểm tra frontend/.env.local." success=""/>}
    <form onSubmit={handleSubmit(async values=>{setError("");try{const {error:e}=await requireSupabase().auth.signInWithPassword({email:values.email,password:values.password});if(e) throw e;router.replace("/library");router.refresh();}catch(e){setError(e instanceof Error?e.message:"Đăng nhập không thành công.");}})} className="space-y-4">
      <Field id="login-email" label="Email" type="email" autoComplete="email" placeholder="ban@example.com" error={errors.email?.message} {...register("email")}/>
      <Field id="login-password" label="Mật khẩu" type="password" autoComplete="current-password" error={errors.password?.message} {...register("password")}/>
      <Feedback error={error} success=""/><button disabled={isSubmitting || !configured} className={btnStyle}>{isSubmitting?"Đang đăng nhập…":"Đăng nhập"}</button>
    </form><div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm"><Link href="/auth/register" className="text-lime-400 hover:underline">Tạo tài khoản mới</Link><Link href="/auth/forgot-password" className="text-mist-300 hover:underline">Quên mật khẩu?</Link></div>
  </Frame>;
}

export function RegisterForm() {
  const { configured } = useAuth();const router=useRouter();
  const [error,setError]=useState("");const [notice,setNotice]=useState("");
  const {register,handleSubmit,formState:{errors,isSubmitting}}=useForm<z.infer<typeof registerSchema>>({resolver:zodResolver(registerSchema)});
  return <Frame icon={<UserRound size={26}/>} title="Tạo tài khoản" description="Tạo hồ sơ Music Discovery Vietnam miễn phí. Mật khẩu được Supabase Auth quản lý, không lưu trong cơ sở dữ liệu ứng dụng.">
    {!configured && <Feedback error="Thiếu cấu hình Supabase trong .env.local." success=""/>}
    <form onSubmit={handleSubmit(async values=>{setError("");setNotice("");try{const {data,error:e}=await requireSupabase().auth.signUp({email:values.email,password:values.password,options:{emailRedirectTo:`${window.location.origin}/auth/callback`,data:{display_name:values.displayName}}});if(e) throw e;if(data.session){router.replace("/settings");router.refresh();}else{setNotice("Yêu cầu đăng ký đã được gửi. Nếu Supabase yêu cầu xác nhận email, hãy mở email và bấm liên kết để hoàn tất.");}}catch(e){setError(e instanceof Error?e.message:"Đăng ký không thành công.");}})} className="space-y-4">
      <Field id="register-name" label="Tên hiển thị" placeholder="Tên của bạn" maxLength={80} autoComplete="nickname" error={errors.displayName?.message} {...register("displayName")}/>
      <Field id="register-email" label="Email" type="email" placeholder="ban@example.com" autoComplete="email" error={errors.email?.message} {...register("email")}/>
      <Field id="register-pass" label="Mật khẩu (ít nhất 8 ký tự)" type="password" autoComplete="new-password" error={errors.password?.message} {...register("password")}/>
      <Field id="register-confirm" label="Nhập lại mật khẩu" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register("confirmPassword")}/>
      <Feedback error={error} success={notice}/><button className={btnStyle} disabled={!configured||isSubmitting}>{isSubmitting?"Đang tạo tài khoản…":"Đăng ký"}</button>
    </form><p className="mt-6 text-sm text-mist-300">Đã có tài khoản? <Link href="/auth/login" className="text-lime-400 hover:underline">Đăng nhập</Link></p>
  </Frame>;
}

export function ForgotPasswordForm() {
  const {configured}=useAuth();const [error,setError]=useState("");const [notice,setNotice]=useState("");
  const {register,handleSubmit,formState:{errors,isSubmitting}}=useForm<z.infer<typeof forgotSchema>>({resolver:zodResolver(forgotSchema)});
  return <Frame icon={<Mail size={26}/>} title="Đặt lại mật khẩu" description="Nhập địa chỉ email. Nếu tài khoản tồn tại, bạn sẽ nhận được liên kết đặt lại mật khẩu.">
    <form onSubmit={handleSubmit(async values=>{setError("");setNotice("");try{const {error:e}=await requireSupabase().auth.resetPasswordForEmail(values.email,{redirectTo:`${window.location.origin}/auth/update-password`});if(e)throw e;setNotice("Nếu email đã đăng ký, hãy kiểm tra hộp thư và thư rác để tìm liên kết đặt lại mật khẩu.");}catch(e){setError(e instanceof Error?e.message:"Không gửi được yêu cầu.");}})} className="space-y-4">
      <Field id="forgot-email" label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")}/><Feedback error={error || (!configured?"Chưa cấu hình Supabase.":"")} success={notice}/><button className={btnStyle} disabled={isSubmitting||!configured}>{isSubmitting?"Đang gửi…":"Gửi liên kết"}</button>
    </form><p className="mt-6 text-sm"><Link href="/auth/login" className="text-lime-400 hover:underline">Quay về đăng nhập</Link></p>
  </Frame>;
}

export function UpdatePasswordForm() {
  const {user,loading,configured}=useAuth();const router=useRouter();const [error,setError]=useState("");const [notice,setNotice]=useState("");
  const {register,handleSubmit,formState:{errors,isSubmitting}}=useForm<z.infer<typeof updateSchema>>({resolver:zodResolver(updateSchema)});
  return <Frame icon={<Music2 size={26}/>} title="Mật khẩu mới" description="Đường dẫn khôi phục phải tạo phiên đăng nhập hợp lệ trước khi đổi mật khẩu.">
    {!loading && !user && <Feedback error="Liên kết khôi phục không hợp lệ, hết hạn hoặc chưa được xử lý. Hãy yêu cầu liên kết mới." success=""/>}
    <form onSubmit={handleSubmit(async values=>{setError("");setNotice("");try{const {error:e}=await requireSupabase().auth.updateUser({password:values.password});if(e)throw e;setNotice("Đã cập nhật mật khẩu. Đang mở trang tài khoản…");router.replace("/settings");}catch(e){setError(e instanceof Error?e.message:"Không đổi được mật khẩu.");}})} className="space-y-4">
      <Field id="update-pass" label="Mật khẩu mới" type="password" autoComplete="new-password" error={errors.password?.message} {...register("password")}/>
      <Field id="update-confirm" label="Nhập lại mật khẩu mới" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register("confirmPassword")}/><Feedback error={error} success={notice}/><button className={btnStyle} disabled={!configured||loading||!user||isSubmitting}>{isSubmitting?"Đang cập nhật…":"Đổi mật khẩu"}</button>
    </form>
  </Frame>;
}
