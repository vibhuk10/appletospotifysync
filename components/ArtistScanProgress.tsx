"use client";

import type { ScanProgress } from "@/lib/types";

export default function ArtistScanProgress({ progress }: { progress: ScanProgress }) {
  const pct = progress.totalPlaylists > 0
    ? Math.round((progress.playlistsScanned / progress.totalPlaylists) * 100)
    : 0;

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center gap-3">
        <span className="inline-block h-4 w-4 rounded-full border-2 border-muted/30 border-t-spotify-green animate-spin" />
        <p className="text-sm font-medium text-foreground">
          Scanning your playlists…
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {progress.playlistsScanned} / {progress.totalPlaylists} playlists
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-card overflow-hidden">
          <div
            className="h-full bg-spotify-green transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {progress.currentPlaylist && (
        <p className="text-xs text-muted-foreground truncate">
          Current: <span className="text-foreground">{progress.currentPlaylist}</span>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="rounded-xl border border-card-border bg-card/50 px-4 py-3">
          <p className="text-xs text-muted-foreground">Unique tracks</p>
          <p className="text-lg font-heading font-semibold text-foreground">
            {progress.uniqueTracks.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-card-border bg-card/50 px-4 py-3">
          <p className="text-xs text-muted-foreground">Artists found</p>
          <p className="text-lg font-heading font-semibold text-foreground">
            {progress.uniqueArtists.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
