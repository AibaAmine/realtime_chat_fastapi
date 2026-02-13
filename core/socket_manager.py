import socketio
from core.config import get_settings

settings = get_settings()

# Use Redis URL from environment for production (Upstash)
mgr = socketio.AsyncRedisManager(settings.REDIS_URL)

# create the async socketio server
sio = socketio.AsyncServer(
    async_mode="asgi",
    client_manager=mgr,
    cors_allowed_origins=settings.ALLOWED_ORIGINS,  # Production CORS
    logger=True,  #  Enable logs
    engineio_logger=True,  #  Enable low-level logs
)


sio_app = socketio.ASGIApp(sio, socketio_path="")
