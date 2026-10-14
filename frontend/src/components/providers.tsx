"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";

type AuthContextValue = { user: User | null; loading: boolean; configured: boolean };
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function AuthProvider({ children, queryClient }: { children: ReactNode; queryClient: QueryClient }) {
  const client = useMemo(() => getSupabaseClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(client));
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!client) return;
    let active = true;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const nextUser = session?.user ?? null;
      if (previousUserId.current !== nextUser?.id) {
        queryClient.clear(); // Không hiển thị cache riêng tư của tài khoản trước.
        previousUserId.current = nextUser?.id ?? null;
      }
      setUser(nextUser);
      setLoading(false);
    });
    // Khởi tạo session. Token trong localStorage chỉ phục vụ UI; truy cập DB vẫn do RLS kiểm tra.
    void client.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (previousUserId.current !== data.user?.id) {
        queryClient.clear();
        previousUserId.current = data.user?.id ?? null;
      }
      setUser(data.user);
      setLoading(false);
    }).catch(() => {
      if (active) { setUser(null); setLoading(false); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [client, queryClient]);

  return <AuthContext.Provider value={{ user, loading, configured: Boolean(client) }}>{children}</AuthContext.Provider>;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  return <QueryClientProvider client={queryClient}><AuthProvider queryClient={queryClient}>{children}</AuthProvider></QueryClientProvider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth phải được sử dụng trong Providers.");
  return context;
}
