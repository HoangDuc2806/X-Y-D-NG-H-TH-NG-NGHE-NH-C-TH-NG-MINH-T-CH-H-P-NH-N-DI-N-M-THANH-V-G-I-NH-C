"use client";

import { useState } from "react";
import { HISTORY_PAGE_SIZE } from "@/lib/library-api";
import { useFavorites, useHistory, usePlaylists } from "@/lib/library-hooks";
import { FavoritesTab } from "@/components/library/favorites-tab";
import { HistoryTab } from "@/components/library/history-tab";
import { PlaylistsTab } from "@/components/library/playlists-tab";

type Tab = "playlists" | "favorites" | "history";

export function LibraryContent() {
  const [tab, setTab] = useState<Tab>("playlists");
  const playlists = usePlaylists();
  const favorites = useFavorites().query;
  const history = useHistory();

  const historyCount = history.data
    ? history.data.length >= HISTORY_PAGE_SIZE
      ? `${HISTORY_PAGE_SIZE}+`
      : String(history.data.length)
    : undefined;

  const tabs: Array<[Tab, string, string | undefined]> = [
    ["playlists", "Playlist", playlists.data ? String(playlists.data.length) : undefined],
    ["favorites", "Yêu thích", favorites.data ? String(favorites.data.length) : undefined],
    ["history", "Đã nghe", historyCount],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Thư viện của bạn">
        {tabs.map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`library-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`library-panel-${id}`}
            onClick={() => setTab(id)}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              tab === id
                ? "border-lime-400 bg-lime-400 font-semibold text-ink-950"
                : "border-ink-700 bg-ink-900 hover:border-lime-500"
            }`}
          >
            {label}
            {count !== undefined ? ` (${count})` : ""}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`library-panel-${tab}`} aria-labelledby={`library-tab-${tab}`}>
        {tab === "playlists" && <PlaylistsTab />}
        {tab === "favorites" && <FavoritesTab />}
        {tab === "history" && <HistoryTab />}
      </div>
    </div>
  );
}
