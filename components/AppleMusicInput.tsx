"use client";

import { useState } from "react";
import type { ScrapeResult } from "@/lib/types";

interface AppleMusicInputProps {
  onResult: (result: ScrapeResult) => void;
  isLoading: boolean;
  onLoadingChange: (loading: boolean) => void;
}

export default function AppleMusicInput({
  onResult,
  isLoading,
  onLoadingChange,
}: AppleMusicInputProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  function validate(value: string): boolean {
    if (!value.trim()) {
      setError("Please enter an Apple Music playlist URL.");
      return false;
    }
    if (!value.includes("music.apple.com")) {
      setError("URL must be from music.apple.com.");
      return false;
    }
    setError(null);
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate(url)) return;

    onLoadingChange(true);
    setError(null);

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to fetch playlist.");
        onLoadingChange(false);
        return;
      }

      if (data.error) {
        setError(data.error);
        onLoadingChange(false);
        return;
      }

      if (!data.tracks || data.tracks.length === 0) {
        setError("No tracks found. The playlist may be empty or private.");
        onLoadingChange(false);
        return;
      }

      onResult({
        tracks: data.tracks,
        playlistName: data.playlistName,
      });
      // Don't call onLoadingChange(false) here — onResult transitions the flow state
    } catch {
      setError("Network error. Please check your connection and try again.");
      onLoadingChange(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="apple-music-url"
            className="block text-sm font-medium text-muted-foreground mb-2"
          >
            Apple Music Playlist URL
          </label>
          <div className="flex gap-3">
            <input
              id="apple-music-url"
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
              }}
              placeholder="https://music.apple.com/us/playlist/..."
              disabled={isLoading}
              className="flex-1 rounded-xl border border-card-border bg-card px-4 py-3 text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-apple-red/40 focus:border-apple-red/50 disabled:opacity-50"
              aria-describedby={error ? "url-error" : undefined}
            />
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-xl px-6 py-3 font-heading font-semibold text-white bg-apple-red hover:bg-apple-red/90 focus:outline-none focus:ring-2 focus:ring-apple-red/40 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
              aria-label="Fetch tracks from Apple Music playlist"
            >
              {isLoading ? (
                <>
                  <span className="inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Fetching...
                </>
              ) : (
                "Fetch Tracks"
              )}
            </button>
          </div>
        </div>

        {error && (
          <p
            id="url-error"
            role="alert"
            className="text-sm text-apple-red animate-fade-in"
          >
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
