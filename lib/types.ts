export interface AppleTrack {
  title: string;
  artist: string;
}

export interface ScrapeResult {
  tracks: AppleTrack[];
  playlistName: string;
  error?: string;
}

export type TrackStatus = "pending" | "searching" | "found" | "not_found" | "skipped";

export interface SyncTrackResult {
  appleTrack: AppleTrack;
  status: TrackStatus;
  spotifyTrack?: {
    id: string;
    name: string;
    artist: string;
    uri: string;
  };
}

export interface SyncSummary {
  total: number;
  added: number;
  skipped: number;
  notFound: number;
  results: SyncTrackResult[];
}

export interface SpotifyPlaylistInfo {
  id: string;
  name: string;
  trackCount: number;
  ownerId?: string;
}

export interface ArtistAggregate {
  id: string;
  name: string;
  trackCount: number;
  trackUris: string[];
}

export type ArtistBuildStatus = "pending" | "building" | "done" | "error";

export interface ArtistBuildResult {
  artist: ArtistAggregate;
  created: boolean;
  added: number;
  skipped: number;
  status: ArtistBuildStatus;
  error?: string;
  playlistId?: string;
}

export interface ScanProgress {
  playlistsScanned: number;
  totalPlaylists: number;
  uniqueTracks: number;
  uniqueArtists: number;
  currentPlaylist?: string;
}
