"use client";

import { useState, useEffect, useCallback } from "react";
import AppleMusicInput from "@/components/AppleMusicInput";
import TrackList from "@/components/TrackList";
import SpotifyAuth from "@/components/SpotifyAuth";
import PlaylistSelector from "@/components/PlaylistSelector";
import SyncProgress from "@/components/SyncProgress";
import SyncResults from "@/components/SyncResults";
import { syncPlaylist, isAuthenticated } from "@/lib/spotify";
import type {
  AppleTrack,
  ScrapeResult,
  SyncTrackResult,
  SyncSummary,
} from "@/lib/types";

type FlowState = "idle" | "scraping" | "scraped" | "syncing" | "done";

export default function Home() {
  // Restore scraped tracks from sessionStorage (survives OAuth redirect)
  const savedResult = typeof window !== "undefined"
    ? (() => {
        try {
          const raw = sessionStorage.getItem("scrapeResult");
          if (raw) {
            const { tracks, playlistName: name } = JSON.parse(raw);
            if (tracks?.length > 0) return { tracks, name: name || "" };
          }
        } catch {
          sessionStorage.removeItem("scrapeResult");
        }
        return null;
      })()
    : null;

  // Flow state
  const [flowState, setFlowState] = useState<FlowState>(savedResult ? "scraped" : "idle");

  // Scrape data
  const [appleTracks, setAppleTracks] = useState<AppleTrack[]>(savedResult?.tracks ?? []);
  const [playlistName, setPlaylistName] = useState(savedResult?.name ?? "");

  // Spotify state
  const [isSpotifyConnected, setIsSpotifyConnected] = useState(
    () => typeof window !== "undefined" && isAuthenticated()
  );
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");

  // Sync state
  const [syncResults, setSyncResults] = useState<SyncTrackResult[]>([]);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);

  // Warn before closing during sync
  useEffect(() => {
    if (flowState !== "syncing") return;

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [flowState]);

  function handleScrapeResult(result: ScrapeResult) {
    setAppleTracks(result.tracks);
    setPlaylistName(result.playlistName);
    setFlowState("scraped");
    sessionStorage.setItem("scrapeResult", JSON.stringify(result));
  }

  function handleScrapeLoading(loading: boolean) {
    setFlowState(loading ? "scraping" : "idle");
  }

  const handleAuthChange = useCallback((authenticated: boolean) => {
    setIsSpotifyConnected(authenticated);
  }, []);

  function handlePlaylistSelect(playlistId: string) {
    setSelectedPlaylistId(playlistId);
  }

  async function handleSync() {
    if (!selectedPlaylistId || appleTracks.length === 0) return;

    setFlowState("syncing");
    setSyncResults([]);
    setSyncProgress(0);

    try {
      const summary = await syncPlaylist(
        appleTracks,
        selectedPlaylistId,
        (results, index) => {
          setSyncResults(results);
          setSyncProgress(index);
        }
      );
      setSyncSummary(summary);
      setFlowState("done");
    } catch (err) {
      // On error, stay in syncing state with the results we have so far
      console.error("Sync failed:", err);
      setFlowState("scraped");
    }
  }

  function handleReset() {
    setFlowState("idle");
    setAppleTracks([]);
    setPlaylistName("");
    setSelectedPlaylistId("");
    setSyncResults([]);
    setSyncProgress(0);
    setSyncSummary(null);
    sessionStorage.removeItem("scrapeResult");
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-12 sm:py-20">
      <main className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <header className="text-center space-y-3 animate-fade-in">
          <h1 className="text-4xl sm:text-5xl font-heading font-bold tracking-tight text-foreground">
            <span className="text-apple-red">Apple Music</span>
            <span className="text-muted-foreground"> to </span>
            <span className="text-spotify-green">Spotify</span>
            <span className="text-foreground"> Sync</span>
          </h1>
          <p className="text-muted-foreground text-base max-w-md mx-auto">
            Paste a playlist link, connect your Spotify, and sync your tracks.
          </p>
        </header>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 animate-fade-in">
          <StepPill
            number={1}
            label="Fetch"
            active={flowState === "idle" || flowState === "scraping"}
            completed={
              flowState === "scraped" ||
              flowState === "syncing" ||
              flowState === "done"
            }
          />
          <StepConnector
            completed={
              flowState === "scraped" ||
              flowState === "syncing" ||
              flowState === "done"
            }
          />
          <StepPill
            number={2}
            label="Connect"
            active={flowState === "scraped" && !isSpotifyConnected}
            completed={
              (flowState === "scraped" && isSpotifyConnected) ||
              flowState === "syncing" ||
              flowState === "done"
            }
          />
          <StepConnector
            completed={flowState === "syncing" || flowState === "done"}
          />
          <StepPill
            number={3}
            label="Sync"
            active={flowState === "syncing"}
            completed={flowState === "done"}
          />
        </div>

        {/* Main content card */}
        <div className="rounded-2xl border border-card-border bg-card/50 backdrop-blur-sm p-6 sm:p-8 space-y-6">
          {/* Step 1: Apple Music Input */}
          {(flowState === "idle" || flowState === "scraping") && (
            <AppleMusicInput
              onResult={handleScrapeResult}
              isLoading={flowState === "scraping"}
              onLoadingChange={handleScrapeLoading}
            />
          )}

          {/* Step 2: Show scraped tracks + Spotify auth + Playlist selection */}
          {flowState === "scraped" && (
            <div className="space-y-6">
              <TrackList tracks={appleTracks} playlistName={playlistName} />

              <div className="border-t border-card-border pt-6 space-y-4">
                <SpotifyAuth onAuthChange={handleAuthChange} />

                {isSpotifyConnected && (
                  <div className="animate-fade-in space-y-4">
                    <PlaylistSelector
                      onSelect={handlePlaylistSelect}
                      suggestedName={playlistName}
                    />

                    {selectedPlaylistId && (
                      <button
                        onClick={handleSync}
                        className="w-full rounded-xl py-3.5 font-heading font-semibold text-white bg-gradient-to-r from-apple-red to-spotify-green hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-spotify-green/40 focus:ring-offset-2 focus:ring-offset-background animate-fade-in"
                        aria-label={`Sync ${appleTracks.length} tracks to Spotify`}
                      >
                        Sync {appleTracks.length} Tracks
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Back button */}
              <button
                onClick={handleReset}
                className="text-xs text-muted-foreground hover:text-foreground focus:outline-none focus:underline"
              >
                Start over with a different playlist
              </button>
            </div>
          )}

          {/* Step 3: Syncing */}
          {flowState === "syncing" && (
            <SyncProgress
              results={syncResults}
              currentIndex={syncProgress}
              total={appleTracks.length}
            />
          )}

          {/* Step 4: Done */}
          {flowState === "done" && syncSummary && (
            <SyncResults summary={syncSummary} onReset={handleReset} />
          )}
        </div>

        {/* Footer */}
        <footer className="text-center animate-fade-in">
          <p className="text-xs text-muted/50">
            Your data is never stored. All processing happens in your browser.
          </p>
        </footer>
      </main>
    </div>
  );
}

/* --- Sub-components for step indicators --- */

function StepPill({
  number,
  label,
  active,
  completed,
}: {
  number: number;
  label: string;
  active: boolean;
  completed: boolean;
}) {
  let pillClasses =
    "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-300";

  if (completed) {
    pillClasses += " bg-spotify-green/10 text-spotify-green";
  } else if (active) {
    pillClasses += " bg-foreground/10 text-foreground";
  } else {
    pillClasses += " bg-card text-muted/50";
  }

  return (
    <div className={pillClasses} aria-current={active ? "step" : undefined}>
      {completed ? (
        <svg
          className="h-3 w-3"
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
      ) : (
        <span>{number}</span>
      )}
      <span>{label}</span>
    </div>
  );
}

function StepConnector({ completed }: { completed: boolean }) {
  return (
    <div
      className={`h-px w-6 transition-colors duration-300 ${
        completed ? "bg-spotify-green/30" : "bg-card-border"
      }`}
      aria-hidden="true"
    />
  );
}
