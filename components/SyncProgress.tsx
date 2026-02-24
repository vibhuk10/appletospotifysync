"use client";

import { useEffect, useRef } from "react";
import type { SyncTrackResult, TrackStatus } from "@/lib/types";

interface SyncProgressProps {
  results: SyncTrackResult[];
  currentIndex: number;
  total: number;
}

function StatusIcon({ status }: { status: TrackStatus }) {
  switch (status) {
    case "pending":
      return (
        <span
          className="inline-block h-2.5 w-2.5 rounded-full bg-muted/40"
          aria-label="Pending"
        />
      );
    case "searching":
      return (
        <span
          className="inline-block h-3.5 w-3.5 rounded-full border-2 border-muted/30 border-t-foreground animate-spin"
          aria-label="Searching"
        />
      );
    case "found":
      return (
        <svg
          className="h-4 w-4 text-spotify-green"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-label="Found and will be added"
        >
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      );
    case "skipped":
      return (
        <svg
          className="h-4 w-4 text-yellow-500"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-label="Skipped - already in playlist"
        >
          <path
            fillRule="evenodd"
            d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
            clipRule="evenodd"
          />
        </svg>
      );
    case "not_found":
      return (
        <svg
          className="h-4 w-4 text-apple-red"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-label="Not found on Spotify"
        >
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      );
  }
}

export default function SyncProgress({
  results,
  currentIndex,
  total,
}: SyncProgressProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  const percent = total > 0 ? Math.round(((currentIndex + 1) / total) * 100) : 0;

  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [currentIndex]);

  return (
    <div className="animate-fade-in space-y-4">
      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-heading font-medium text-foreground">
            Syncing tracks...
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            {currentIndex + 1} / {total}
          </span>
        </div>
        <div
          className="h-2 rounded-full bg-card-border overflow-hidden"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Sync progress: ${percent}%`}
        >
          <div
            className="h-full rounded-full progress-shimmer"
            style={{ width: `${percent}%`, transition: "width 0.3s ease-out" }}
          />
        </div>
      </div>

      {/* Track list */}
      <div
        ref={scrollRef}
        className="max-h-80 overflow-y-auto rounded-xl border border-card-border bg-card"
        aria-label="Sync progress for each track"
      >
        {results.map((result, i) => (
          <div
            key={`${result.appleTrack.title}-${i}`}
            ref={i === currentIndex ? activeRef : undefined}
            className={`flex items-center gap-3 px-4 py-2.5 ${
              i % 2 === 0 ? "bg-card" : "bg-white/[0.02]"
            } ${i !== results.length - 1 ? "border-b border-card-border/50" : ""} ${
              i === currentIndex ? "bg-white/[0.04]" : ""
            }`}
          >
            <div className="w-5 flex items-center justify-center shrink-0">
              <StatusIcon status={result.status} />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm truncate ${
                  result.status === "not_found"
                    ? "text-muted-foreground line-through"
                    : "text-foreground"
                }`}
              >
                {result.appleTrack.title}
              </p>
              <p className="text-xs text-muted/70 truncate">
                {result.appleTrack.artist}
              </p>
            </div>
            {result.spotifyTrack && result.status === "found" && (
              <span className="text-[10px] text-spotify-green/70 shrink-0">
                matched
              </span>
            )}
            {result.status === "skipped" && (
              <span className="text-[10px] text-yellow-500/70 shrink-0">
                exists
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
