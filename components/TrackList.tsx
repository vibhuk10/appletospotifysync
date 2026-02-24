"use client";

import type { AppleTrack } from "@/lib/types";

interface TrackListProps {
  tracks: AppleTrack[];
  playlistName: string;
}

export default function TrackList({ tracks, playlistName }: TrackListProps) {
  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-heading font-semibold text-foreground">
          {playlistName}
        </h2>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-card border border-card-border text-muted-foreground">
          {tracks.length} {tracks.length === 1 ? "track" : "tracks"}
        </span>
      </div>

      <div
        className="max-h-96 overflow-y-auto rounded-xl border border-card-border bg-card"
        role="list"
        aria-label={`Tracks in ${playlistName}`}
      >
        {tracks.map((track, i) => (
          <div
            key={`${track.title}-${track.artist}-${i}`}
            role="listitem"
            className={`flex items-center gap-4 px-4 py-3 ${
              i % 2 === 0 ? "bg-card" : "bg-white/[0.02]"
            } ${i !== tracks.length - 1 ? "border-b border-card-border/50" : ""}`}
          >
            <span className="w-8 text-right text-xs font-mono text-muted/60 shrink-0">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {track.title}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {track.artist}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
