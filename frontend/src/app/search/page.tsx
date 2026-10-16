import { PageHeader } from "@/components/page-header";
import { SpotifySearch } from "@/components/spotify-search";

type SearchPageProps = { searchParams?: { q?: string | string[] } };

export default function Page({ searchParams }: SearchPageProps) {
  const rawQuery = searchParams?.q;
  const initialQuery = Array.isArray(rawQuery) ? rawQuery[0] ?? "" : rawQuery ?? "";
  return (
    <>
      <PageHeader title="Tìm kiếm Spotify" description="Tìm bài hát, nghệ sĩ và album trong danh mục Spotify; nghe bằng trình phát nhúng hoặc mở Spotify." />
      <SpotifySearch initialQuery={initialQuery} />
    </>
  );
}
