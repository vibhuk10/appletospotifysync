import {
  getUserPlaylists,
  getPlaylistTracksDetailed,
  getExistingPlaylistTracks,
  createPlaylist,
  addTracksToPlaylist,
  getCurrentUser,
} from "./spotify";
import type {
  ArtistAggregate,
  ArtistBuildResult,
  ScanProgress,
  SpotifyPlaylistInfo,
} from "./types";

export interface ArtistEntry {
  id: string;
  name: string;
  trackIds: Set<string>;
  uris: Map<string, string>;
}

export interface ScanResult {
  artists: Map<string, ArtistEntry>;
  totalUniqueTracks: number;
  sourcePlaylists: SpotifyPlaylistInfo[];
  userId: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function collectTracksByArtist(
  onProgress: (p: ScanProgress) => void
): Promise<ScanResult> {
  const user = await getCurrentUser();
  const playlists = await getUserPlaylists();
  const artists = new Map<string, ArtistEntry>();
  const seenTrackIds = new Set<string>();

  onProgress({
    playlistsScanned: 0,
    totalPlaylists: playlists.length,
    uniqueTracks: 0,
    uniqueArtists: 0,
  });

  for (let i = 0; i < playlists.length; i++) {
    const pl = playlists[i];
    onProgress({
      playlistsScanned: i,
      totalPlaylists: playlists.length,
      uniqueTracks: seenTrackIds.size,
      uniqueArtists: artists.size,
      currentPlaylist: pl.name,
    });

    let tracks;
    try {
      tracks = await getPlaylistTracksDetailed(pl.id);
    } catch (err) {
      console.error(`Failed to fetch playlist ${pl.name}:`, err);
      continue;
    }

    for (const t of tracks) {
      const firstTime = !seenTrackIds.has(t.id);
      if (firstTime) seenTrackIds.add(t.id);
      for (const a of t.artists) {
        let entry = artists.get(a.id);
        if (!entry) {
          entry = {
            id: a.id,
            name: a.name,
            trackIds: new Set(),
            uris: new Map(),
          };
          artists.set(a.id, entry);
        }
        if (!entry.trackIds.has(t.id)) {
          entry.trackIds.add(t.id);
          entry.uris.set(t.id, t.uri);
        }
      }
    }

    await sleep(150);
  }

  onProgress({
    playlistsScanned: playlists.length,
    totalPlaylists: playlists.length,
    uniqueTracks: seenTrackIds.size,
    uniqueArtists: artists.size,
  });

  return {
    artists,
    totalUniqueTracks: seenTrackIds.size,
    sourcePlaylists: playlists,
    userId: user.id,
  };
}

export function qualifyingArtists(
  artists: Map<string, ArtistEntry>,
  threshold = 10
): ArtistAggregate[] {
  const result: ArtistAggregate[] = [];
  for (const a of artists.values()) {
    if (a.trackIds.size >= threshold) {
      result.push({
        id: a.id,
        name: a.name,
        trackCount: a.trackIds.size,
        trackUris: Array.from(a.uris.values()),
      });
    }
  }
  result.sort((a, b) => b.trackCount - a.trackCount || a.name.localeCompare(b.name));
  return result;
}

export async function runArtistPlaylistBuild(
  selected: ArtistAggregate[],
  userId: string,
  sourcePlaylists: SpotifyPlaylistInfo[],
  onProgress: (results: ArtistBuildResult[], index: number) => void
): Promise<ArtistBuildResult[]> {
  const ownedByName = new Map<string, SpotifyPlaylistInfo>();
  for (const p of sourcePlaylists) {
    if (p.ownerId === userId) {
      ownedByName.set(p.name, p);
    }
  }

  const results: ArtistBuildResult[] = selected.map((a) => ({
    artist: a,
    created: false,
    added: 0,
    skipped: 0,
    status: "pending" as const,
  }));

  for (let i = 0; i < selected.length; i++) {
    const artist = selected[i];
    results[i].status = "building";
    onProgress([...results], i);

    try {
      const existing = ownedByName.get(artist.name);
      let playlistId: string;
      let existingIds = new Set<string>();

      if (existing) {
        playlistId = existing.id;
        const tracks = await getExistingPlaylistTracks(existing.id);
        existingIds = tracks.ids;
      } else {
        const created = await createPlaylist(artist.name);
        playlistId = created.id;
        results[i].created = true;
        ownedByName.set(artist.name, { ...created, ownerId: userId });
      }

      const toAdd: string[] = [];
      let skipped = 0;
      for (const uri of artist.trackUris) {
        const id = uri.split(":").pop() || "";
        if (existingIds.has(id)) {
          skipped++;
        } else {
          toAdd.push(uri);
          existingIds.add(id);
        }
      }

      if (toAdd.length > 0) {
        await addTracksToPlaylist(playlistId, toAdd);
      }

      results[i].playlistId = playlistId;
      results[i].added = toAdd.length;
      results[i].skipped = skipped;
      results[i].status = "done";
    } catch (err) {
      results[i].status = "error";
      results[i].error = err instanceof Error ? err.message : String(err);
    }

    onProgress([...results], i);
    await sleep(200);
  }

  return results;
}
