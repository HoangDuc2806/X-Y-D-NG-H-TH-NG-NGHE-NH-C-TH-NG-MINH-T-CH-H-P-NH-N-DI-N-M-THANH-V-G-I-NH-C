import { Home, Search, Mic, Compass, Library, Settings, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Trang chủ", icon: Home },
  { href: "/search", label: "Tìm kiếm", icon: Search },
  { href: "/identify", label: "Nhận diện", icon: Mic },
  { href: "/discover", label: "Khám phá", icon: Compass },
  { href: "/library", label: "Thư viện", icon: Library },
  { href: "/settings", label: "Tài khoản", icon: Settings },
];
