import { PageHeader } from "@/components/page-header";
import { BackendStatus } from "@/components/backend-status";
import { MusicLibrary } from "@/components/music-library";

export default function HomePage() {
  return (
    <>
      <PageHeader
        title="Kho nhạc"
        description="Khám phá bài hát trong danh mục Spotify tại Việt Nam, phát nhạc bằng tài khoản Spotify Premium hoặc mở bản gốc trên Spotify."
      />
      <div className="mb-6">
        <BackendStatus />
      </div>
      <MusicLibrary />
    </>
  );
}
