import { NextRequest, NextResponse } from "next/server";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/120.0.0.0 Safari/537.36";

interface Track {
  title: string;
  artist: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = body.url as string;

    if (!url || !url.includes("music.apple.com")) {
      return NextResponse.json(
        { error: "Invalid Apple Music URL" },
        { status: 400 }
      );
    }

    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch Apple Music page: ${res.status}` },
        { status: 502 }
      );
    }

    const html = await res.text();
    const playlistName = extractPlaylistName(html);

    let tracks = extractFromSerializedData(html);
    if (tracks.length === 0) tracks = extractFromJsonLd(html);
    if (tracks.length === 0) tracks = extractFromMetaTags(html);

    if (tracks.length === 0) {
      return NextResponse.json({
        tracks: [],
        playlistName,
        error: "No tracks found. The playlist may be empty or private.",
      });
    }

    return NextResponse.json({ tracks, playlistName });
  } catch (err) {
    return NextResponse.json(
      { error: `Internal error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}

function extractPlaylistName(html: string): string {
  // Try og:title
  const ogMatch = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
  );
  if (ogMatch) return ogMatch[1];

  // Try <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    const title = titleMatch[1].trim();
    if (title.includes(" - ")) {
      return title.split(" - ").slice(0, -1).join(" - ").trim();
    }
    return title;
  }

  return "";
}

function extractFromSerializedData(html: string): Track[] {
  const tracks: Track[] = [];

  // Find all script tag contents
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;

  while ((scriptMatch = scriptRegex.exec(html)) !== null) {
    const text = scriptMatch[1];
    if (!text || text.length < 10) continue;

    const blobs: unknown[] = [];

    // Try to find JSON arrays starting with [{"intent"
    const intentRegex = /\[\{"intent".*?\}\](?=\s*<)/gs;
    let intentMatch;
    while ((intentMatch = intentRegex.exec(text)) !== null) {
      try {
        blobs.push(JSON.parse(intentMatch[0]));
      } catch {
        continue;
      }
    }

    // Try parsing entire content as JSON
    if (blobs.length === 0) {
      const stripped = text.trim();
      if (stripped.startsWith("[") || stripped.startsWith("{")) {
        try {
          const data = JSON.parse(stripped);
          blobs.push(Array.isArray(data) ? data : [data]);
        } catch {
          // not JSON
        }
      }
    }

    for (const blob of blobs) {
      walkJsonForTracks(blob, tracks);
    }
  }

  return tracks;
}

function walkJsonForTracks(obj: unknown, tracks: Track[]): void {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const dict = obj as Record<string, unknown>;
    const objId = String(dict.id ?? "");
    const title = dict.title as string | undefined;
    const subtitleLinks = dict.subtitleLinks as
      | Array<{ title?: string }>
      | undefined;

    if (objId.includes("track-lockup") && title && subtitleLinks) {
      const artist =
        Array.isArray(subtitleLinks) && subtitleLinks.length > 0
          ? subtitleLinks[0].title ?? ""
          : "";
      tracks.push({ title, artist });
      return;
    }

    if (dict.itemKind === "trackLockup" && title) {
      const artist =
        Array.isArray(subtitleLinks) && subtitleLinks.length > 0
          ? subtitleLinks[0].title ?? ""
          : "";
      if (artist || title) {
        tracks.push({ title, artist });
        return;
      }
    }

    for (const value of Object.values(dict)) {
      walkJsonForTracks(value, tracks);
    }
  } else if (Array.isArray(obj)) {
    for (const item of obj) {
      walkJsonForTracks(item, tracks);
    }
  }
}

function extractFromJsonLd(html: string): Track[] {
  const tracks: Track[] = [];
  const ldRegex =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = ldRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      if (data?.["@type"] === "MusicPlaylist") {
        for (const item of data.track ?? []) {
          const name = item.name ?? "";
          let artist = "";
          const by = item.byArtist;
          if (by && typeof by === "object" && !Array.isArray(by)) {
            artist = by.name ?? "";
          } else if (Array.isArray(by) && by.length > 0) {
            artist = by[0].name ?? "";
          }
          if (name) tracks.push({ title: name, artist });
        }
      }
    } catch {
      continue;
    }
  }

  return tracks;
}

function extractFromMetaTags(html: string): Track[] {
  const tracks: Track[] = [];
  const metaRegex =
    /<meta[^>]+property=["']music:song["'][^>]+content=["']([^"']+)["']/gi;
  let match;

  while ((match = metaRegex.exec(html)) !== null) {
    if (match[1]) tracks.push({ title: match[1], artist: "" });
  }

  return tracks;
}
