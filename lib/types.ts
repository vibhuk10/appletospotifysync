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
}
