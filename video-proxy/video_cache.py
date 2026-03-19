"""
Redis caching layer for resolved YouTube stream URLs.
YouTube direct URLs expire after ~6h, so we use 5h TTL.
omnilearn.space | Afflatus Consulting Group
"""

import json
import os
from datetime import timedelta
from typing import Optional

import redis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CACHE_TTL_HOURS = int(os.getenv("VIDEO_CACHE_TTL_HOURS", "5"))


class VideoURLCache:
    def __init__(self, redis_url: str = REDIS_URL):
        self.redis = redis.from_url(redis_url, decode_responses=True)
        self.ttl = timedelta(hours=CACHE_TTL_HOURS)

    def get(self, video_id: str) -> Optional[dict]:
        cached = self.redis.get(f"video:stream:{video_id}")
        if cached:
            return json.loads(cached)
        return None

    def set(self, video_id: str, data: dict):
        self.redis.setex(
            f"video:stream:{video_id}",
            self.ttl,
            json.dumps(data),
        )

    def invalidate(self, video_id: str):
        self.redis.delete(f"video:stream:{video_id}")

    def health_check(self) -> bool:
        try:
            return self.redis.ping()
        except Exception:
            return False
