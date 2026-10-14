const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type HealthResponse = { status: string; service: string };

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { signal });
  } catch {
    throw new ApiError("Không kết nối được tới máy chủ.");
  }
  if (!res.ok) throw new ApiError("Máy chủ trả về lỗi.", res.status);
  return (await res.json()) as T;
}

export const getHealth = (signal?: AbortSignal) => apiGet<HealthResponse>("/api/health", signal);
