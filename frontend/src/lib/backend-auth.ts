import { ApiError } from "@/lib/api";

export async function verifyBackendSession(accessToken: string): Promise<{id:string;email:string|null}> {
  let res: Response;
  try {
    res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/me`, {
      headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store",
    });
  } catch {
    throw new ApiError("Không kết nối được FastAPI.");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {error?:{message?:string}} | null;
    throw new ApiError(body?.error?.message ?? "Xác thực thất bại.", res.status);
  }
  return res.json() as Promise<{id:string;email:string|null}>;
}
