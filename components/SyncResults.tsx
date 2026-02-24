"use client";

import { useState } from "react";
import type { SyncSummary } from "@/lib/types";

interface SyncResultsProps {
  summary: SyncSummary;
  onReset: () => void;
}

export default function SyncResults({ summary, onReset }: SyncResultsProps) {
  const [showNotFound, setShowNotFound] = useState(false);

  const notFoundTracks = summary.results.filter(
    (r) => r.status === "not_found"
  );

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-spotify-green/10 mb-3">
          <svg
            className="h-7 w-7 text-spotify-green"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h2 className="text-xl font-heading font-semibold text-foreground">
          Sync Complete
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {summary.total} tracks processed
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-spotify-green/20 bg-spotify-green/5 p-4 text-center">
          <p className="text-2xl font-heading font-bold text-spotify-green">
            {summary.added}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Added</p>
        </div>
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-center">
          <p className="text-2xl font-heading font-bold text-yellow-500">
            {summary.skipped}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Skipped</p>
        </div>
        <div className="rounded-xl border border-apple-red/20 bg-apple-red/5 p-4 text-center">
          <p className="text-2xl font-heading font-bold text-apple-red">
            {summary.notFound}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Not Found</p>
        </div>
      </div>

      {/* Not found list */}
      {notFoundTracks.length > 0 && (
        <div>
          <button
            onClick={() => setShowNotFound(!showNotFound)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground focus:outline-none focus:underline"
            aria-expanded={showNotFound}
            aria-controls="not-found-list"
          >
            <svg
              className={`h-4 w-4 transition-transform duration-200 ${
                showNotFound ? "rotate-90" : ""
              }`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
            {notFoundTracks.length} track{notFoundTracks.length !== 1 ? "s" : ""}{" "}
            not found
          </button>

          {showNotFound && (
            <div
              id="not-found-list"
              className="mt-3 max-h-60 overflow-y-auto rounded-xl border border-card-border bg-card animate-fade-in"
              role="list"
              aria-label="Tracks not found on Spotify"
            >
              {notFoundTracks.map((result, i) => (
                <div
                  key={`${result.appleTrack.title}-${i}`}
                  role="listitem"
                  className={`flex items-center gap-3 px-4 py-2.5 ${
                    i !== notFoundTracks.length - 1
                      ? "border-b border-card-border/50"
                      : ""
                  }`}
                >
                  <svg
                    className="h-3.5 w-3.5 text-apple-red shrink-0"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-muted-foreground truncate">
                      {result.appleTrack.title}
                    </p>
                    <p className="text-xs text-muted/60 truncate">
                      {result.appleTrack.artist}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reset button */}
      <button
        onClick={onReset}
        className="w-full rounded-xl border border-card-border px-6 py-3 text-sm font-heading font-semibold text-foreground hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-muted/30 focus:ring-offset-2 focus:ring-offset-background"
      >
        Sync Another Playlist
      </button>
    </div>
  );
}
