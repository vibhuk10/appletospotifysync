import type {
  AppleTrack,
  SyncTrackResult,
  SyncSummary,
  SpotifyPlaylistInfo,
} from "./types";
import { normalize } from "./normalize";

const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID!;
const SCOPES = "playlist-read-private playlist-modify-public playlist-modify-private";
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";

function getRedirectUri(): string {
  // Spotify rejects "localhost" as a redirect URI — use 127.0.0.1 for local dev
  const origin = window.location.origin.replace("://localhost", "://127.0.0.1");
  return `${origin}/callback`;
}

// --- PKCE Helpers ---

function generateCodeVerifier(length = 128): string {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// --- Auth Flow ---

export async function redirectToSpotifyAuth(): Promise<void> {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);

  localStorage.setItem("spotify_code_verifier", verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: getRedirectUri(),
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: challenge,
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<void> {
  const verifier = localStorage.getItem("spotify_code_verifier");
  if (!verifier) throw new Error("Missing code verifier");

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(),
    code_verifier: verifier,
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error_description || "Token exchange failed");
  }

  const data = await response.json();
  localStorage.setItem("spotify_access_token", data.access_token);
  localStorage.setItem("spotify_refresh_token", data.refresh_token);
  localStorage.setItem("spotify_token_expires", String(Date.now() + data.expires_in * 1000));
  localStorage.removeItem("spotify_code_verifier");
}

async function refreshAccessToken(): Promise<void> {
  const refreshToken = localStorage.getItem("spotify_refresh_token");
  if (!refreshToken) throw new Error("No refresh token");

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  if (!response.ok) {
    clearAuth();
    throw new Error("Token refresh failed");
  }

  const data = await response.json();
  localStorage.setItem("spotify_access_token", data.access_token);
  localStorage.setItem("spotify_token_expires", String(Date.now() + data.expires_in * 1000));
  if (data.refresh_token) {
    localStorage.setItem("spotify_refresh_token", data.refresh_token);
  }
}

async function getAccessToken(): Promise<string> {
  const expires = Number(localStorage.getItem("spotify_token_expires") || 0);
  // Refresh if token expires within 60 seconds
  if (Date.now() > expires - 60_000) {
    await refreshAccessToken();
  }
  return localStorage.getItem("spotify_access_token")!;
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem("spotify_access_token");
}

export function clearAuth(): void {
  localStorage.removeItem("spotify_access_token");
  localStorage.removeItem("spotify_refresh_token");
  localStorage.removeItem("spotify_token_expires");
  localStorage.removeItem("spotify_code_verifier");
}

// --- Spotify API Helpers ---

async function spotifyFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  // Only set Content-Type for requests with a body
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string>),
    },
  });

  // Handle rate limiting
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("Retry-After") || 1);
    await sleep(retryAfter * 1000);
    return spotifyFetch(path, options);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Spotify API ${response.status}: ${path}`, errorBody);
    if (response.status === 401) {
      clearAuth();
    }
    throw new Error(`Spotify API error ${response.status}: ${path}`);
  }

  return response;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- User Info ---

export async function getCurrentUser(): Promise<{ id: string; displayName: string }> {
  const res = await spotifyFetch("/me");
  const data = await res.json();
  return { id: data.id, displayName: data.display_name || data.id };
}

// --- Playlist Management ---

export async function getUserPlaylists(): Promise<SpotifyPlaylistInfo[]> {
  const playlists: SpotifyPlaylistInfo[] = [];
  let url = "/me/playlists?limit=50";

  while (url) {
    const res = await spotifyFetch(url);
    const data = await res.json();
    for (const p of data.items || []) {
      playlists.push({
        id: p.id,
        name: p.name,
        trackCount: (p.tracks?.total ?? p.items?.total) ?? 0,
      });
    }
    // next is a full URL, extract the path
    if (data.next) {
      url = data.next.replace(API_BASE, "");
    } else {
      url = "";
    }
  }

  return playlists;
}

export async function createPlaylist(
  name: string
): Promise<SpotifyPlaylistInfo> {
  const res = await spotifyFetch("/me/playlists", {
    method: "POST",
    body: JSON.stringify({ name, public: false }),
  });
  const data = await res.json();
  return { id: data.id, name: data.name, trackCount: 0 };
}

// --- Search & Match ---

async function searchTrack(
  title: string,
  artist: string
): Promise<{ id: string; name: string; artist: string; uri: string } | null> {
  try {
    // Try specific search first
    const specificQuery = encodeURIComponent(`track:${title} artist:${artist}`);
    let res = await spotifyFetch(`/search?q=${specificQuery}&type=track&limit=5`);
    let data = await res.json();
    let tracks = data?.tracks?.items || [];

    if (tracks.length > 0) {
      // Try to find a good match
      const normTitle = normalize(title);
      const normArtist = normalize(artist);

      for (const t of tracks) {
        const spTitle = normalize(t.name);
        const spArtist = normalize(t.artists?.[0]?.name || "");
        if (
          (normTitle.includes(spTitle) || spTitle.includes(normTitle)) &&
          (normArtist.includes(spArtist) || spArtist.includes(normArtist))
        ) {
          return {
            id: t.id,
            name: t.name,
            artist: t.artists?.[0]?.name || "",
            uri: t.uri,
          };
        }
      }
      // No strong match - return top result
      const top = tracks[0];
      return {
        id: top.id,
        name: top.name,
        artist: top.artists?.[0]?.name || "",
        uri: top.uri,
      };
    }

    // Fallback: simpler query
    const fallbackQuery = encodeURIComponent(`${title} ${artist}`);
    res = await spotifyFetch(`/search?q=${fallbackQuery}&type=track&limit=3`);
    data = await res.json();
    tracks = data?.tracks?.items || [];

    if (tracks.length > 0) {
      const top = tracks[0];
      return {
        id: top.id,
        name: top.name,
        artist: top.artists?.[0]?.name || "",
        uri: top.uri,
      };
    }

    return null;
  } catch (err) {
    console.error(`Search failed for "${title}" - "${artist}":`, err);
    return null;
  }
}

// --- Get Existing Playlist Tracks ---

async function getExistingPlaylistTracks(
  playlistId: string
): Promise<{ ids: Set<string>; normalized: Set<string> }> {
  const ids = new Set<string>();
  const normalized = new Set<string>();
  let url = `/playlists/${playlistId}/items?limit=100&fields=items(item(id,name,artists(name))),next`;

  while (url) {
    const res = await spotifyFetch(url);
    const data = await res.json();

    for (const item of data.items || []) {
      const track = item.item ?? item.track;
      if (!track?.id) continue;
      ids.add(track.id);
      const normTitle = normalize(track.name || "");
      const normArtist = normalize(track.artists?.[0]?.name || "");
      normalized.add(`${normTitle}|||${normArtist}`);
    }

    if (data.next) {
      url = data.next.replace(API_BASE, "");
    } else {
      url = "";
    }
  }

  return { ids, normalized };
}

// --- Sync Orchestrator ---

export async function syncPlaylist(
  appleTracks: AppleTrack[],
  playlistId: string,
  onProgress: (results: SyncTrackResult[], index: number) => void
): Promise<SyncSummary> {
  // Fetch existing tracks for dedup
  const existing = await getExistingPlaylistTracks(playlistId);

  const results: SyncTrackResult[] = appleTracks.map((t) => ({
    appleTrack: t,
    status: "pending" as const,
  }));

  const toAdd: string[] = [];
  let added = 0;
  let skipped = 0;
  let notFound = 0;

  for (let i = 0; i < appleTracks.length; i++) {
    const track = appleTracks[i];
    results[i].status = "searching";
    onProgress([...results], i);

    const match = await searchTrack(track.title, track.artist);

    if (!match) {
      results[i].status = "not_found";
      notFound++;
      onProgress([...results], i);
      await sleep(100);
      continue;
    }

    // Check by ID
    if (existing.ids.has(match.id)) {
      results[i].status = "skipped";
      results[i].spotifyTrack = match;
      skipped++;
      onProgress([...results], i);
      await sleep(100);
      continue;
    }

    // Check by normalized title+artist
    const normKey = `${normalize(match.name)}|||${normalize(match.artist)}`;
    if (existing.normalized.has(normKey)) {
      results[i].status = "skipped";
      results[i].spotifyTrack = match;
      skipped++;
      onProgress([...results], i);
      await sleep(100);
      continue;
    }

    results[i].status = "found";
    results[i].spotifyTrack = match;
    toAdd.push(match.uri);
    existing.ids.add(match.id);
    existing.normalized.add(normKey);
    onProgress([...results], i);
    await sleep(100);
  }

  // Add tracks in batches of 100
  for (let i = 0; i < toAdd.length; i += 100) {
    const batch = toAdd.slice(i, i + 100);
    await spotifyFetch(`/playlists/${playlistId}/items`, {
      method: "POST",
      body: JSON.stringify({ uris: batch }),
    });
  }

  added = toAdd.length;

  return {
    total: appleTracks.length,
    added,
    skipped,
    notFound,
    results,
  };
}
