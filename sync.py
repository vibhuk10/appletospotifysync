#!/usr/bin/env python3
"""
Sync an Apple Music playlist to a Spotify playlist.

Scrapes the public Apple Music playlist page, searches Spotify for each track,
and adds any new (non-duplicate) tracks to the target Spotify playlist.
"""
from __future__ import annotations

import json
import os
import re
import sys

import requests
import spotipy
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from spotipy.oauth2 import SpotifyOAuth


def scrape_apple_music_playlist(url: str) -> list[dict]:
    """Scrape song titles and artists from a public Apple Music playlist page."""
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

    # Apple Music embeds playlist data as JSON in script tags.
    # Strategy 1: Look for serialized server data in script tags.
    tracks = _extract_from_serialized_data(soup)
    if tracks:
        return tracks

    # Strategy 2: Look for JSON-LD structured data.
    tracks = _extract_from_json_ld(soup)
    if tracks:
        return tracks

    # Strategy 3: Parse meta / schema markup as fallback.
    tracks = _extract_from_meta_tags(soup)
    if tracks:
        return tracks

    print("Warning: Could not extract tracks from Apple Music page.")
    print("The page structure may have changed. Try updating the scraper.")
    return []


def _extract_from_serialized_data(soup: BeautifulSoup) -> list[dict]:
    """Extract tracks from the serialized JSON blob Apple Music embeds."""
    tracks = []

    for script in soup.find_all("script"):
        text = script.string
        if not text:
            continue

        # Look for the embedded data that contains track-lockup items.
        # Apple Music pages embed a large JSON array with playlist data.
        json_blobs = []

        # Try to find JSON arrays starting with [{"intent"
        for match in re.finditer(r'\[{"intent".*?\}\](?=\s*<)', text, re.DOTALL):
            try:
                json_blobs.append(json.loads(match.group()))
            except json.JSONDecodeError:
                continue

        # Also try: the entire script content might be JSON or assigned to a var
        if not json_blobs:
            # Try parsing entire content as JSON
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
        # Check if this dict looks like a track entry
        obj_id = obj.get("id", "")
        title = obj.get("title")
        subtitle_links = obj.get("subtitleLinks")

        if "track-lockup" in str(obj_id) and title and subtitle_links:
            artist = ""
            if isinstance(subtitle_links, list) and subtitle_links:
                artist = subtitle_links[0].get("title", "")
            tracks.append({"title": title, "artist": artist})
            return  # Don't recurse further into this track

        # Also handle itemKind == "trackLockup" pattern
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

        # MusicPlaylist schema
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


def normalize(s: str) -> str:
    """Normalize a string for fuzzy comparison."""
    s = s.lower().strip()
    # Remove feat./ft./featuring and everything after
    s = re.sub(r"\s*[\(\[](feat\.?|ft\.?|featuring).*?[\)\]]", "", s)
    s = re.sub(r"\s*(feat\.?|ft\.?|featuring)\s+.*$", "", s)
    # Remove common suffixes like (Deluxe), (Remix), etc. only from artist names
    # Keep punctuation removal minimal to avoid false matches
    s = re.sub(r"[''`]", "'", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def get_spotify_client() -> spotipy.Spotify:
    """Create an authenticated Spotify client."""
    return spotipy.Spotify(auth_manager=SpotifyOAuth(
        scope="playlist-read-private playlist-modify-public playlist-modify-private",
        redirect_uri=os.environ["SPOTIPY_REDIRECT_URI"],
        client_id=os.environ["SPOTIPY_CLIENT_ID"],
        client_secret=os.environ["SPOTIPY_CLIENT_SECRET"],
    ))


def get_existing_playlist_tracks(sp: spotipy.Spotify, playlist_id: str) -> dict[str, tuple[str, str]]:
    """
    Fetch all tracks currently in the Spotify playlist.

    Returns a dict mapping track_id -> (normalized_title, normalized_artist).
    """
    existing = {}
    offset = 0
    while True:
        results = sp.playlist_items(
            playlist_id, offset=offset, limit=100,
            fields="items(track(id,name,artists(name))),next"
        )
        items = results.get("items", [])
        if not items:
            break
        for item in items:
            track = item.get("track")
            if not track or not track.get("id"):
                continue
            title = normalize(track["name"])
            artist = normalize(track["artists"][0]["name"]) if track.get("artists") else ""
            existing[track["id"]] = (title, artist)
        if not results.get("next"):
            break
        offset += len(items)
    return existing


def search_spotify_track(sp: spotipy.Spotify, title: str, artist: str) -> dict | None:
    """
    Search Spotify for a track by title and artist.

    Returns the top result dict with id/name/artists, or None.
    """
    # Try specific search first
    query = f"track:{title} artist:{artist}"
    results = sp.search(q=query, type="track", limit=5)
    tracks = results.get("tracks", {}).get("items", [])

    if tracks:
        # Try to find a good match
        for t in tracks:
            sp_title = normalize(t["name"])
            sp_artist = normalize(t["artists"][0]["name"]) if t.get("artists") else ""
            if normalize(title) in sp_title or sp_title in normalize(title):
                if normalize(artist) in sp_artist or sp_artist in normalize(artist):
                    return t
        # If no strong match, return the top result
        return tracks[0]

    # Fallback: simpler query
    query = f"{title} {artist}"
    results = sp.search(q=query, type="track", limit=3)
    tracks = results.get("tracks", {}).get("items", [])
    return tracks[0] if tracks else None


def sync_playlist(apple_music_url: str, spotify_playlist_id: str):
    """Main sync logic."""
    print(f"Scraping Apple Music playlist: {apple_music_url}")
    apple_tracks = scrape_apple_music_playlist(apple_music_url)
    print(f"Found {len(apple_tracks)} tracks on Apple Music\n")

    if not apple_tracks:
        print("No tracks found. Exiting.")
        return

    print("Connecting to Spotify...")
    sp = get_spotify_client()
    me = sp.current_user()
    print(f"Logged in as: {me['display_name']}\n")

    print(f"Fetching existing tracks from Spotify playlist {spotify_playlist_id}...")
    existing = get_existing_playlist_tracks(sp, spotify_playlist_id)
    print(f"Playlist currently has {len(existing)} tracks\n")

    # Build a set of normalized (title, artist) for existing tracks
    existing_normalized = set(existing.values())
    existing_ids = set(existing.keys())

    to_add = []
    already_in = 0
    not_found = 0
    not_found_list = []

    print("Searching Spotify for Apple Music tracks...")
    for i, at in enumerate(apple_tracks, 1):
        title = at["title"]
        artist = at["artist"]
        suffix = f" [{i}/{len(apple_tracks)}]"

        result = search_spotify_track(sp, title, artist)
        if not result:
            not_found += 1
            not_found_list.append(f"  {title} - {artist}")
            print(f"  NOT FOUND: {title} - {artist}{suffix}")
            continue

        track_id = result["id"]

        # Check by ID first
        if track_id in existing_ids:
            already_in += 1
            print(f"  SKIP (dup): {title} - {artist}{suffix}")
            continue

        # Check by normalized title+artist to catch different versions
        sp_title = normalize(result["name"])
        sp_artist = normalize(result["artists"][0]["name"]) if result.get("artists") else ""
        if (sp_title, sp_artist) in existing_normalized:
            already_in += 1
            print(f"  SKIP (dup): {title} - {artist}{suffix}")
            continue

        to_add.append(track_id)
        existing_ids.add(track_id)
        existing_normalized.add((sp_title, sp_artist))
        print(f"  ADD: {title} - {artist} -> {result['name']} by {result['artists'][0]['name']}{suffix}")

    # Add tracks in batches of 100
    added = 0
    for batch_start in range(0, len(to_add), 100):
        batch = to_add[batch_start:batch_start + 100]
        sp.playlist_add_items(spotify_playlist_id, batch)
        added += len(batch)

    # Summary
    print("\n" + "=" * 50)
    print("SYNC SUMMARY")
    print("=" * 50)
    print(f"Apple Music tracks found: {len(apple_tracks)}")
    print(f"Already in Spotify playlist: {already_in}")
    print(f"Newly added to Spotify: {added}")
    print(f"Not found on Spotify: {not_found}")
    if not_found_list:
        print("\nTracks not found on Spotify:")
        for t in not_found_list:
            print(t)


def main():
    load_dotenv()

    # Validate required env vars
    required = ["SPOTIPY_CLIENT_ID", "SPOTIPY_CLIENT_SECRET", "SPOTIPY_REDIRECT_URI"]
    missing = [v for v in required if not os.environ.get(v)]
    if missing:
        print(f"Error: Missing environment variables: {', '.join(missing)}")
        print("Copy .env.example to .env and fill in your Spotify credentials.")
        sys.exit(1)

    apple_music_url = os.environ.get(
        "APPLE_MUSIC_URL",
        "https://music.apple.com/us/playlist/aux-3/pl.u-4Jomrm9FaPJ18jj"
    )
    spotify_playlist_id = os.environ.get("SPOTIFY_PLAYLIST_ID", "5rl3eMwTdM6i5ygHRVTCLP")

    sync_playlist(apple_music_url, spotify_playlist_id)


if __name__ == "__main__":
    main()
