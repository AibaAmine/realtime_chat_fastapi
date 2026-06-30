import redis
import json
from core.config import get_settings

settings = get_settings()

# Use Redis URL from environment for production (Upstash)
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)


async def set_user_online(user_id: str, ttl: int = 3600):
    """Mark user as online in Redis with TTL"""
    key = f"user:{user_id}:status"
    redis_client.setex(key, ttl, "online")
    print(f" User {user_id} marked as online")


async def set_user_offline(user_id: str):
    """Mark user as offline in Redis"""
    key = f"user:{user_id}:status"
    redis_client.delete(key)
    print(f" User {user_id} marked as offline")


async def is_user_online(user_id: str) -> bool:
    """Check if user is online"""
    key = f"user:{user_id}:status"
    return redis_client.exists(key) > 0


async def blocklist_token(jti: str, ttl_seconds: int):
    """Blocklist an access token's jti until it would have expired anyway"""
    if ttl_seconds <= 0:
        return
    key = f"blocklist:{jti}"
    redis_client.setex(key, ttl_seconds, "1")


async def is_token_blocklisted(jti: str) -> bool:
    """Check if an access token's jti has been revoked (e.g. via logout)"""
    if not jti:
        return False
    key = f"blocklist:{jti}"
    return redis_client.exists(key) > 0
