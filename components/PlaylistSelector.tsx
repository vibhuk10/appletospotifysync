"use client";

import { useEffect, useState } from "react";
import {
  getUserPlaylists,
  createPlaylist,
  getCurrentUser,
} from "@/lib/spotify";
import type { SpotifyPlaylistInfo } from "@/lib/types";

interface PlaylistSelectorProps {
  onSelect: (playlistId: string) => void;
  suggestedName: string;
}

type Mode = "select" | "create";

export default function PlaylistSelector({
  onSelect,
  suggestedName,
}: PlaylistSelectorProps) {
  const [playlists, setPlaylists] = useState<SpotifyPlaylistInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("select");
  const [newName, setNewName] = useState(suggestedName);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    async function fetchPlaylists() {
      try {
        const data = await getUserPlaylists();
        setPlaylists(data);
      } catch {
        setError("Failed to load playlists.");
      } finally {
        setLoading(false);
      }
    }
    fetchPlaylists();
  }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);

    try {
      const user = await getCurrentUser();
      const playlist = await createPlaylist(user.id, newName.trim());
      setPlaylists((prev) => [playlist, ...prev]);
      setSelectedId(playlist.id);
      setMode("select");
      onSelect(playlist.id);
    } catch {
      setError("Failed to create playlist.");
    } finally {
      setCreating(false);
    }
  }

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (value === "__create__") {
      setMode("create");
      setSelectedId("");
      onSelect("");
    } else {
      setSelectedId(value);
      setMode("select");
      onSelect(value);
    }
  }

  if (loading) {
    return (
      <div className="animate-fade-in flex items-center gap-3 rounded-xl border border-card-border bg-card px-4 py-3">
        <span className="inline-block h-4 w-4 rounded-full border-2 border-muted/30 border-t-muted animate-spin" />
        <span className="text-sm text-muted-foreground">
          Loading your playlists...
        </span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-3">
      <label
        htmlFor="playlist-select"
        className="block text-sm font-medium text-muted-foreground"
      >
        Destination Playlist
      </label>

      <select
        id="playlist-select"
        value={mode === "create" ? "__create__" : selectedId}
        onChange={handleSelectChange}
        className="w-full rounded-xl border border-card-border bg-card px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-spotify-green/40 focus:border-spotify-green/50 appearance-none cursor-pointer"
        aria-label="Select a Spotify playlist"
      >
        <option value="" disabled>
          Choose a playlist...
        </option>
        <option value="__create__">+ Create new playlist</option>
        {playlists.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.trackCount} tracks)
          </option>
        ))}
      </select>

      {mode === "create" && (
        <div className="flex gap-3 animate-fade-in">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Playlist name"
            className="flex-1 rounded-xl border border-card-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-spotify-green/40 focus:border-spotify-green/50"
            aria-label="Name for new playlist"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
            }}
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="rounded-xl px-5 py-2.5 text-sm font-heading font-semibold text-white bg-spotify-green hover:bg-spotify-green/90 focus:outline-none focus:ring-2 focus:ring-spotify-green/40 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
            aria-label="Create new Spotify playlist"
          >
            {creating ? (
              <>
                <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Creating...
              </>
            ) : (
              "Create"
            )}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-apple-red animate-fade-in">
          {error}
        </p>
      )}
    </div>
  );
}
