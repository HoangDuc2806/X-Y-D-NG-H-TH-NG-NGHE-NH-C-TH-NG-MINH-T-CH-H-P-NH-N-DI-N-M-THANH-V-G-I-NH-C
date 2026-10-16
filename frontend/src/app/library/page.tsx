"use client";

import { PageHeader } from "@/components/page-header";
import { AuthGate } from "@/components/auth-gate";
import { LibraryContent } from "@/components/library/library-content";

export default function Page() {
  return (
    <>
      <PageHeader
        title="Thư viện của bạn"
        description="Playlist, bài hát yêu thích và lịch sử nghe, riêng tư theo tài khoản."
      />
      <AuthGate>
        <LibraryContent />
      </AuthGate>
    </>
  );
}
