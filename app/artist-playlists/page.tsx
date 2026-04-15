"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import SpotifyAuth from "@/components/SpotifyAuth";
import ArtistScanProgress from "@/components/ArtistScanProgress";
import ArtistPreview from "@/components/ArtistPreview";
import ArtistBuildProgress from "@/components/ArtistBuildProgress";
import {
  collectTracksByArtist,
  qualifyingArtists,
  runArtistPlaylistBuild,
} from "@/lib/artistPlaylists";
import { isAuthenticated } from "@/lib/spotify";
import type {
  ArtistAggregate,
  ArtistBuildResult,
  ScanProgress,
  SpotifyPlaylistInfo,
} from "@/lib/types";

type FlowState = "idle" | "scanning" | "preview" | "building" | "done";

const THRESHOLD = 10;

export default function ArtistPlaylistsPage() {
  const [isConnected, setIsConnected] = useState(
    () => typeof window !== "undefined" && isAuthenticated()
  );
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [scanProgress, setScanProgress] = useState<ScanProgress>({
    playlistsScanned: 0,
    totalPlaylists: 0,
    uniqueTracks: 0,
    uniqueArtists: 0,
  });
  const [qualified, setQualified] = useState<ArtistAggregate[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [sourcePlaylists, setSourcePlaylists] = useState<SpotifyPlaylistInfo[]>([]);
  const [buildResults, setBuildResults] = useState<ArtistBuildResult[]>([]);
  const [buildIndex, setBuildIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAuthChange = useCallback((authenticated: boolean) => {
    setIsConnected(authenticated);
  }, []);

  useEffect(() => {
    if (flowState !== "building") return;
    function beforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [flowState]);

  async function handleStartScan() {
    setErrorMsg(null);
    setFlowState("scanning");
    try {
      const result = await collectTracksByArtist((p) => setScanProgress(p));
      const artists = qualifyingArtists(result.artists, THRESHOLD);
      setQualified(artists);
      setUserId(result.userId);
      setSourcePlaylists(result.sourcePlaylists);
      setFlowState("preview");
    } catch (err) {
      console.error("Scan failed:", err);
      setErrorMsg(err instanceof Error ? err.message : "Scan failed");
      setFlowState("idle");
    }
  }

  async function handleBuild(selected: ArtistAggregate[]) {
    setErrorMsg(null);
    setFlowState("building");
    setBuildResults(
      selected.map((a) => ({
        artist: a,
        created: false,
        added: 0,
        skipped: 0,
        status: "pending",
      }))
    );
    setBuildIndex(0);

    try {
      await runArtistPlaylistBuild(
        selected,
        userId,
        sourcePlaylists,
        (results, idx) => {
          setBuildResults(results);
          setBuildIndex(idx);
        }
      );
      setFlowState("done");
    } catch (err) {
      console.error("Build failed:", err);
      setErrorMsg(err instanceof Error ? err.message : "Build failed");
      setFlowState("done");
    }
  }

  function handleReset() {
    setFlowState("idle");
    setQualified([]);
    setBuildResults([]);
    setBuildIndex(0);
    setErrorMsg(null);
    setScanProgress({
      playlistsScanned: 0,
      totalPlaylists: 0,
      uniqueTracks: 0,
      uniqueArtists: 0,
    });
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-12 sm:py-20">
      <main className="w-full max-w-2xl space-y-8">
        <header className="text-center space-y-3 animate-fade-in">
          <h1 className="text-4xl sm:text-5xl font-heading font-bold tracking-tight text-foreground">
            <span className="text-spotify-green">Artist</span>
            <span className="text-foreground"> Playlists</span>
          </h1>
          <p className="text-muted-foreground text-base max-w-md mx-auto">
            Scan your Spotify library and auto-create a playlist for every artist
            with {THRESHOLD}+ songs.
          </p>
          <Link
            href="/"
            className="inline-block text-xs text-muted-foreground hover:text-foreground focus:outline-none focus:underline"
          >
            ← Back to Apple Music sync
          </Link>
        </header>

        <div className="rounded-2xl border border-card-border bg-card/50 backdrop-blur-sm p-6 sm:p-8 space-y-6">
          {!isConnected && (
            <div className="space-y-4">
              <p className="text-sm text-foreground">
                Connect your Spotify account to continue.
              </p>
              <SpotifyAuth onAuthChange={handleAuthChange} />
            </div>
          )}

          {isConnected && flowState === "idle" && (
            <div className="space-y-4 animate-fade-in">
              <SpotifyAuth onAuthChange={handleAuthChange} />
              <div className="space-y-2">
                <p className="text-sm text-foreground">
                  We&apos;ll scan every playlist you can see on Spotify, count how many
                  distinct songs you have per artist, and build a playlist for each
                  artist with {THRESHOLD} or more.
                </p>
                <p className="text-xs text-muted-foreground">
                  Existing playlists with an artist&apos;s exact name will be reused
                  (only missing tracks get added).
                </p>
              </div>
              {errorMsg && (
                <p className="text-sm text-apple-red">{errorMsg}</p>
              )}
              <button
                onClick={handleStartScan}
                className="w-full rounded-xl py-3.5 font-heading font-semibold text-white bg-spotify-green hover:bg-spotify-green/90 focus:outline-none focus:ring-2 focus:ring-spotify-green/40 focus:ring-offset-2 focus:ring-offset-background"
              >
                Scan my playlists
              </button>
            </div>
          )}

          {isConnected && flowState === "scanning" && (
            <ArtistScanProgress progress={scanProgress} />
          )}

          {isConnected && flowState === "preview" && (
            <ArtistPreview
              artists={qualified}
              onBuild={handleBuild}
              onBack={handleReset}
            />
          )}

          {isConnected && (flowState === "building" || flowState === "done") && (
            <ArtistBuildProgress
              results={buildResults}
              currentIndex={buildIndex}
              total={buildResults.length}
              done={flowState === "done"}
              onReset={flowState === "done" ? handleReset : undefined}
            />
          )}
        </div>

        <footer className="text-center animate-fade-in">
          <p className="text-xs text-muted/50">
            Your data is never stored. All processing happens in your browser.
          </p>
        </footer>
      </main>
    </div>
  );
}
