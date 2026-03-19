"""
YouTube URL resolution via yt-dlp for OmniLearn.
Extracts direct stream URLs from YouTube videos, stripping all branding.
omnilearn.space | Afflatus Consulting Group
"""

import logging
import os
import re
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timedelta
from typing import Optional

import yt_dlp

log = logging.getLogger("youtube_resolver")

YOUTUBE_PATTERNS = [
    r'(?:https?://)?(?:www\.)?youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})',
    r'(?:https?://)?(?:www\.)?youtube\.com/embed/([a-zA-Z0-9_-]{11})',
    r'(?:https?://)?(?:www\.)?youtube\.com/v/([a-zA-Z0-9_-]{11})',
    r'(?:https?://)?youtu\.be/([a-zA-Z0-9_-]{11})',
    r'(?:https?://)?(?:www\.)?youtube\.com/shorts/([a-zA-Z0-9_-]{11})',
    r'(?:https?://)?(?:www\.)?youtube\.com/live/([a-zA-Z0-9_-]{11})',
]

YTDLP_COOKIES_PATH = os.getenv("YTDLP_COOKIES_PATH", "")
YTDLP_BROWSER_COOKIES = os.getenv("YTDLP_BROWSER_COOKIES", "")
YTDLP_MAX_QUALITY = os.getenv("YTDLP_MAX_QUALITY", "720p")

_REALISTIC_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

_PLAYER_CLIENT_STRATEGIES = [
    "ios,web",
    "android,web",
    "tv,web",
    "default",
]


def extract_video_id(url: str) -> Optional[str]:
    """Extract YouTube video ID from any supported URL format."""
    for pattern in YOUTUBE_PATTERNS:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    parsed = urlparse(url)
    hostname = parsed.hostname or ""
    if "youtube.com" in hostname:
        qs = parse_qs(parsed.query)
        if "v" in qs:
            return qs["v"][0]
    return None


def _build_base_opts(height_limit: str) -> dict:
    """Build base yt-dlp options shared across retry strategies."""
    opts = {
        "format": (
            f"bestvideo[height<={height_limit}]+bestaudio"
            f"/best[height<={height_limit}]/best"
        ),
        "no_warnings": True,
        "quiet": True,
        "extract_flat": False,
        "no_check_certificates": True,
        "skip_download": True,
        "user_agent": _REALISTIC_USER_AGENT,
        "socket_timeout": 15,
    }
    if YTDLP_COOKIES_PATH and os.path.isfile(YTDLP_COOKIES_PATH):
        opts["cookiefile"] = YTDLP_COOKIES_PATH
    if YTDLP_BROWSER_COOKIES:
        opts["cookiesfrombrowser"] = (YTDLP_BROWSER_COOKIES,)
    return opts


def _pick_stream(info: dict) -> str:
    """Select the best combined mp4 stream URL from extraction info."""
    stream_url = info.get("url")
    formats = info.get("formats", [])
    combined = [
        f for f in formats
        if f.get("vcodec") != "none" and f.get("acodec") != "none"
    ]
    if combined:
        mp4_formats = [f for f in combined if f.get("ext") == "mp4"]
        target = mp4_formats[-1] if mp4_formats else combined[-1]
        stream_url = target["url"]
    return stream_url


def resolve_stream_url(video_id: str, preferred_quality: str = "") -> dict:
    """
    Use yt-dlp to get a direct streamable URL.
    Tries multiple player-client strategies to work around bot detection.
    Returns dict with stream_url, duration, title, thumbnail, width, height, expires_at.
    """
    quality = preferred_quality or YTDLP_MAX_QUALITY
    height_limit = quality.replace("p", "")
    url = f"https://www.youtube.com/watch?v={video_id}"
    last_err: Optional[Exception] = None

    for strategy in _PLAYER_CLIENT_STRATEGIES:
        opts = _build_base_opts(height_limit)
        if strategy != "default":
            opts["extractor_args"] = {
                "youtube": {"player_client": strategy.split(",")}
            }

        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=False)

            stream_url = _pick_stream(info)
            if not stream_url:
                raise ValueError("yt-dlp returned no stream URL")

            log.info("Resolved %s via strategy=%s", video_id, strategy)
            return {
                "stream_url": stream_url,
                "duration": info.get("duration", 0),
                "title": info.get("title", ""),
                "thumbnail": info.get("thumbnail", ""),
                "width": info.get("width", 1280),
                "height": info.get("height", 720),
                "expires_at": (
                    datetime.utcnow() + timedelta(hours=5)
                ).isoformat(),
            }
        except Exception as exc:
            last_err = exc
            log.warning(
                "Strategy %s failed for %s: %s", strategy, video_id, exc
            )
            continue

    raise last_err or RuntimeError(f"All strategies exhausted for {video_id}")
