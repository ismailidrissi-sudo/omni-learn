"""
Video Proxy Microservice for OmniLearn
Resolves YouTube URLs to direct stream URLs via yt-dlp, caches in Redis.
NestJS backend calls this service for URL resolution; NestJS handles byte proxying.
omnilearn.space | Afflatus Consulting Group
"""

import os
from typing import Optional

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from youtube_resolver import extract_video_id, resolve_stream_url
from video_cache import VideoURLCache

app = FastAPI(title="OmniLearn Video Proxy")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

INTERNAL_SERVICE_KEY = os.getenv("INTERNAL_SERVICE_KEY", "")
cache: Optional[VideoURLCache] = None


@app.on_event("startup")
def startup():
    global cache
    try:
        cache = VideoURLCache()
        cache.health_check()
    except Exception as e:
        print(f"[video-proxy] Redis connection failed: {e}. Running without cache.")
        cache = None


def verify_internal_key(x_internal_key: str = Header(default="")):
    if INTERNAL_SERVICE_KEY and x_internal_key != INTERNAL_SERVICE_KEY:
        raise HTTPException(status_code=403, detail="Invalid internal service key")


class ResolveRequest(BaseModel):
    url: str
    preferred_quality: Optional[str] = None


@app.get("/health")
def health():
    redis_ok = cache.health_check() if cache else False
    return {"status": "ok", "redis": redis_ok}


@app.post("/resolve")
def resolve_video(
    payload: ResolveRequest,
    x_internal_key: str = Header(default=""),
):
    """
    Accepts a YouTube URL, extracts video ID, resolves via yt-dlp.
    Returns stream URL + metadata. Caches for 5h.
    """
    verify_internal_key(x_internal_key)

    video_id = extract_video_id(payload.url)
    if not video_id:
        raise HTTPException(400, "Invalid or unsupported YouTube URL")

    if cache:
        cached = cache.get(video_id)
        if cached:
            return {
                "video_id": video_id,
                "stream_url": cached["stream_url"],
                "duration": cached["duration"],
                "title": cached["title"],
                "thumbnail": cached["thumbnail"],
                "width": cached.get("width", 1280),
                "height": cached.get("height", 720),
                "expires_at": cached["expires_at"],
                "cached": True,
            }

    try:
        data = resolve_stream_url(video_id, payload.preferred_quality or "")
    except Exception as e:
        raise HTTPException(
            502,
            f"Failed to resolve video. It may be private, restricted, or unavailable. Error: {str(e)}",
        )

    if cache:
        cache.set(video_id, data)

    return {
        "video_id": video_id,
        "stream_url": data["stream_url"],
        "duration": data["duration"],
        "title": data["title"],
        "thumbnail": data["thumbnail"],
        "width": data.get("width", 1280),
        "height": data.get("height", 720),
        "expires_at": data["expires_at"],
        "cached": False,
    }


@app.get("/stream-url/{video_id}")
def get_stream_url(
    video_id: str,
    x_internal_key: str = Header(default=""),
):
    """
    Returns the cached stream URL for a video ID.
    Re-resolves if cache has expired.
    Called by NestJS to get the upstream URL for byte proxying.
    """
    verify_internal_key(x_internal_key)

    if cache:
        cached = cache.get(video_id)
        if cached:
            return {
                "stream_url": cached["stream_url"],
                "thumbnail": cached.get("thumbnail", ""),
                "duration": cached.get("duration", 0),
            }

    try:
        data = resolve_stream_url(video_id)
    except Exception as e:
        raise HTTPException(502, f"Failed to resolve video: {str(e)}")

    if cache:
        cache.set(video_id, data)

    return {
        "stream_url": data["stream_url"],
        "thumbnail": data.get("thumbnail", ""),
        "duration": data.get("duration", 0),
    }
