# Apple Music to Spotify Playlist Sync

Syncs tracks from a public Apple Music playlist to a Spotify playlist, skipping duplicates.

## Setup

### 1. Install dependencies

```bash
cd apple_to_spotify_sync
pip install -r requirements.txt
```

### 2. Create a Spotify Developer App

1. Go to https://developer.spotify.com/dashboard
2. Click "Create App"
3. Set the **Redirect URI** to `http://localhost:8888/callback`
4. Note your **Client ID** and **Client Secret**

### 3. Configure credentials

```bash
cp .env.example .env
```

Edit `.env` and fill in your Spotify Client ID and Client Secret. The playlist IDs are pre-filled.

### 4. Run

```bash
python sync.py
```

On first run, a browser window will open for Spotify OAuth. Log in and authorize the app. The token is cached in `.cache` for subsequent runs.

## Configuration

All config is in `.env`:

| Variable | Description |
|---|---|
| `SPOTIPY_CLIENT_ID` | Spotify app Client ID |
| `SPOTIPY_CLIENT_SECRET` | Spotify app Client Secret |
| `SPOTIPY_REDIRECT_URI` | OAuth redirect URI (default: `http://localhost:8888/callback`) |
| `SPOTIFY_PLAYLIST_ID` | Target Spotify playlist ID |
| `APPLE_MUSIC_URL` | Source Apple Music playlist URL |
