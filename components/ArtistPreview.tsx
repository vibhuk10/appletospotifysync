"use client";

import { useState } from "react";
import type { ArtistAggregate } from "@/lib/types";

interface Props {
  artists: ArtistAggregate[];
  onBuild: (selected: ArtistAggregate[]) => void;
  onBack: () => void;
}

export default function ArtistPreview({ artists, onBuild, onBack }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(artists.map((a) => a.id))
  );

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === artists.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(artists.map((a) => a.id)));
    }
  }

  function handleBuild() {
    const selected = artists.filter((a) => selectedIds.has(a.id));
    if (selected.length === 0) return;
    onBuild(selected);
  }

  if (artists.length === 0) {
    return (
      <div className="animate-fade-in space-y-4 text-center">
        <p className="text-sm text-foreground">
          No artists with 10 or more songs across your playlists.
        </p>
        <button
          onClick={onBack}
          className="text-xs text-muted-foreground hover:text-foreground focus:outline-none focus:underline"
        >
          Start over
        </button>
      </div>
    );
  }

  const allSelected = selectedIds.size === artists.length;

  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h2 className="text-lg font-heading font-semibold text-foreground">
          {artists.length} qualifying {artists.length === 1 ? "artist" : "artists"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Each has 10+ songs in your library. Choose which to turn into playlists.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={toggleAll}
          className="text-xs font-medium text-muted-foreground hover:text-foreground focus:outline-none focus:underline"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
        <p className="text-xs text-muted-foreground">
          {selectedIds.size} selected
        </p>
      </div>

      <ul className="max-h-96 overflow-y-auto rounded-xl border border-card-border bg-card/30 divide-y divide-card-border">
        {artists.map((a) => {
          const checked = selectedIds.has(a.id);
          return (
            <li key={a.id}>
              <label className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-white/5">
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(a.id)}
                    className="h-4 w-4 accent-spotify-green"
                  />
                  <span className="text-sm font-medium text-foreground truncate">
                    {a.name}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {a.trackCount} songs
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-3">
        <button
          onClick={handleBuild}
          disabled={selectedIds.size === 0}
          className="flex-1 rounded-xl py-3.5 font-heading font-semibold text-white bg-gradient-to-r from-apple-red to-spotify-green hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-spotify-green/40 focus:ring-offset-2 focus:ring-offset-background"
        >
          Create {selectedIds.size} {selectedIds.size === 1 ? "Playlist" : "Playlists"}
        </button>
      </div>

      <button
        onClick={onBack}
        className="text-xs text-muted-foreground hover:text-foreground focus:outline-none focus:underline"
      >
        Rescan
      </button>
    </div>
  );
}
