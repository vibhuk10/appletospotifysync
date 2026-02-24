"use client";

import { useEffect, useState } from "react";
import {
  isAuthenticated,
  redirectToSpotifyAuth,
  clearAuth,
  getCurrentUser,
} from "@/lib/spotify";

interface SpotifyAuthProps {
  onAuthChange: (authenticated: boolean) => void;
}

export default function SpotifyAuth({ onAuthChange }: SpotifyAuthProps) {
  const [connected, setConnected] = useState(
    () => typeof window !== "undefined" && isAuthenticated()
  );
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(
    () => typeof window !== "undefined" && isAuthenticated()
  );

  useEffect(() => {
    onAuthChange(connected);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    getCurrentUser()
      .then((user) => {
        if (!cancelled) setDisplayName(user.displayName);
      })
      .catch(() => {
        if (!cancelled) {
          clearAuth();
          setConnected(false);
          onAuthChange(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [connected, onAuthChange]);

  function handleConnect() {
    redirectToSpotifyAuth();
  }

  function handleDisconnect() {
    clearAuth();
    setConnected(false);
    setDisplayName(null);
    onAuthChange(false);
  }

  if (loading) {
    return (
      <div className="animate-fade-in flex items-center gap-3 rounded-xl border border-card-border bg-card px-4 py-3">
        <span className="inline-block h-4 w-4 rounded-full border-2 border-muted/30 border-t-muted animate-spin" />
        <span className="text-sm text-muted-foreground">
          Checking Spotify connection...
        </span>
      </div>
    );
  }

  if (connected) {
    return (
      <div className="animate-fade-in flex items-center justify-between rounded-xl border border-spotify-green/20 bg-spotify-green/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-spotify-green/20">
            <svg
              className="h-4 w-4 text-spotify-green"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">
              Connected to Spotify
            </p>
            {displayName && (
              <p className="text-xs text-muted-foreground">{displayName}</p>
            )}
          </div>
        </div>
        <button
          onClick={handleDisconnect}
          className="text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg px-3 py-1.5 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-muted/30"
          aria-label="Disconnect from Spotify"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <button
        onClick={handleConnect}
        className="w-full flex items-center justify-center gap-3 rounded-xl px-6 py-3.5 font-heading font-semibold text-white bg-spotify-green hover:bg-spotify-green/90 focus:outline-none focus:ring-2 focus:ring-spotify-green/40 focus:ring-offset-2 focus:ring-offset-background"
        aria-label="Connect your Spotify account"
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
        </svg>
        Connect Spotify
      </button>
    </div>
  );
}
