"""
YouTube URL resolution via yt-dlp for OmniLearn.
Extracts direct stream URLs from YouTube videos, stripping all branding.
omnilearn.space | Afflatus Consulting Group
"""

import os
import re
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timedelta
from typing import Optional

import yt_dlp

YOUTUBE_PATTERNS = [
    r'(?:https?://)?(?:www\.)?youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})',
    r'(?:https?://)?(?:www\.)?youtube\.com/embed/([a-zA-Z0-9_-]{11})',
    r'(?:https?://)?(?:www\.)?youtube\.com/v/([a-zA-Z0-9_-]{11})',
    r'(?:https?://)?youtu\.be/([a-zA-Z0-9_-]{11})',
    r'(?:https?://)?(?:www\.)?youtube\.com/shorts/([a-zA-Z0-9_-]{11})',
    r'(?:https?://)?(?:www\.)?youtube\.com/live/([a-zA-Z0-9_-]{11})',
]

YTDLP_COOKIES_PATH = os.getenv("YTDLP_COOKIES_PATH", "")
YTDLP_MAX_QUALITY = os.getenv("YTDLP_MAX_QUALITY", "720p")


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


def resolve_stream_url(video_id: str, preferred_quality: str = "") -> dict:
    """
    Use yt-dlp to get a direct streamable URL.
    Returns dict with stream_url, duration, title, thumbnail, width, height, expires_at.

    Direct URLs from YouTube expire after ~6 hours.
    """
    quality = preferred_quality or YTDLP_MAX_QUALITY
    height_limit = quality.replace("p", "")

    ydl_opts = {
        "format": f"bestvideo[height<={height_limit}]+bestaudio/best[height<={height_limit}]/best",
        "no_warnings": True,
        "quiet": True,
        "extract_flat": False,
        "no_check_certificates": True,
        "skip_download": True,
    }

    if YTDLP_COOKIES_PATH:
        ydl_opts["cookiefile"] = YTDLP_COOKIES_PATH

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(
            f"https://www.youtube.com/watch?v={video_id}", download=False
        )

        stream_url = info.get("url")

        formats = info.get("formats", [])
        combined = [
            f
            for f in formats
            if f.get("vcodec") != "none" and f.get("acodec") != "none"
        ]
        if combined:
            mp4_formats = [f for f in combined if f.get("ext") == "mp4"]
            target = mp4_formats[-1] if mp4_formats else combined[-1]
            stream_url = target["url"]

        return {
            "stream_url": stream_url,
            "duration": info.get("duration", 0),
            "title": info.get("title", ""),
            "thumbnail": info.get("thumbnail", ""),
            "width": info.get("width", 1280),
            "height": info.get("height", 720),
            "expires_at": (datetime.utcnow() + timedelta(hours=5)).isoformat(),
        }
