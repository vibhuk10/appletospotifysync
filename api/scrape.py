"""
Vercel Python serverless function - scrapes Apple Music playlist pages.
POST /api/scrape with JSON body: { "url": "https://music.apple.com/..." }
Returns JSON: { "tracks": [...], "playlistName": "..." }
"""
from __future__ import annotations

import json
import re
from http.server import BaseHTTPRequestHandler

import requests
from bs4 import BeautifulSoup


def scrape_apple_music_playlist(url: str) -> tuple[list[dict], str]:
    """Scrape song titles/artists and playlist name from a public Apple Music playlist page."""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }
    resp = requests.get(url, headers=headers, timeout=30)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")

    # Extract playlist name from the page title or meta tags
    playlist_name = _extract_playlist_name(soup)

    # Strategy 1: Look for serialized server data in script tags.
    tracks = _extract_from_serialized_data(soup)
    if tracks:
        return tracks, playlist_name

    # Strategy 2: Look for JSON-LD structured data.
    tracks = _extract_from_json_ld(soup)
    if tracks:
        return tracks, playlist_name

    # Strategy 3: Parse meta / schema markup as fallback.
    tracks = _extract_from_meta_tags(soup)
    return tracks, playlist_name


def _extract_playlist_name(soup: BeautifulSoup) -> str:
    """Extract the playlist name from the page."""
    # Try og:title meta tag
    og_title = soup.find("meta", attrs={"property": "og:title"})
    if og_title and og_title.get("content"):
        return og_title["content"]

    # Try the page title
    title_tag = soup.find("title")
    if title_tag and title_tag.string:
        # Apple Music titles are usually "Playlist Name - Apple Music"
        title = title_tag.string.strip()
        if " - " in title:
            return title.rsplit(" - ", 1)[0].strip()
        return title

    return ""


def _extract_from_serialized_data(soup: BeautifulSoup) -> list[dict]:
    """Extract tracks from the serialized JSON blob Apple Music embeds."""
    tracks = []

    for script in soup.find_all("script"):
        text = script.string
        if not text:
            continue

        json_blobs = []

        for match in re.finditer(r'\[{"intent".*?\}\](?=\s*<)', text, re.DOTALL):
            try:
                json_blobs.append(json.loads(match.group()))
            except json.JSONDecodeError:
                continue

        if not json_blobs:
            stripped = text.strip()
            if stripped.startswith("[") or stripped.startswith("{"):
                try:
                    data = json.loads(stripped)
                    json_blobs.append(data if isinstance(data, list) else [data])
                except json.JSONDecodeError:
                    pass

        for blob in json_blobs:
            _walk_json_for_tracks(blob, tracks)

    return tracks


def _walk_json_for_tracks(obj, tracks: list[dict]):
    """Recursively walk a JSON structure to find track-lockup items."""
    if isinstance(obj, dict):
        obj_id = obj.get("id", "")
        title = obj.get("title")
        subtitle_links = obj.get("subtitleLinks")

        if "track-lockup" in str(obj_id) and title and subtitle_links:
            artist = ""
            if isinstance(subtitle_links, list) and subtitle_links:
                artist = subtitle_links[0].get("title", "")
            tracks.append({"title": title, "artist": artist})
            return

        if obj.get("itemKind") == "trackLockup" and title:
            artist = ""
            if isinstance(subtitle_links, list) and subtitle_links:
                artist = subtitle_links[0].get("title", "")
            if artist or title:
                tracks.append({"title": title, "artist": artist})
                return

        for value in obj.values():
            _walk_json_for_tracks(value, tracks)

    elif isinstance(obj, list):
        for item in obj:
            _walk_json_for_tracks(item, tracks)


def _extract_from_json_ld(soup: BeautifulSoup) -> list[dict]:
    """Extract tracks from JSON-LD structured data if present."""
    tracks = []
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string)
        except (json.JSONDecodeError, TypeError):
            continue

        if isinstance(data, dict) and data.get("@type") == "MusicPlaylist":
            for item in data.get("track", []):
                name = item.get("name", "")
                artist = ""
                by = item.get("byArtist")
                if isinstance(by, dict):
                    artist = by.get("name", "")
                elif isinstance(by, list) and by:
                    artist = by[0].get("name", "")
                if name:
                    tracks.append({"title": name, "artist": artist})
    return tracks


def _extract_from_meta_tags(soup: BeautifulSoup) -> list[dict]:
    """Fallback: extract whatever we can from meta tags."""
    tracks = []
    for meta in soup.find_all("meta", attrs={"property": "music:song"}):
        content = meta.get("content", "")
        if content:
            tracks.append({"title": content, "artist": ""})
    return tracks


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()

    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)
            url = data.get("url", "")

            if not url or "music.apple.com" not in url:
                self._send_json(400, {"error": "Invalid Apple Music URL"})
                return

            tracks, playlist_name = scrape_apple_music_playlist(url)

            if not tracks:
                self._send_json(200, {
                    "tracks": [],
                    "playlistName": playlist_name,
                    "error": "No tracks found. The playlist may be empty or private.",
                })
                return

            self._send_json(200, {
                "tracks": tracks,
                "playlistName": playlist_name,
            })

        except requests.exceptions.RequestException as e:
            self._send_json(502, {"error": f"Failed to fetch Apple Music page: {str(e)}"})
        except Exception as e:
            self._send_json(500, {"error": f"Internal error: {str(e)}"})

    def _send_json(self, status: int, data: dict):
        self.send_response(status)
        self._set_cors_headers()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def _set_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
