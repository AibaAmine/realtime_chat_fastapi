import redis
import json

redis_client = redis.Redis(host="localhost", port=6379, db=0, decode_responses=True)


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
