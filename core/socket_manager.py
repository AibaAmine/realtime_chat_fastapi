import socketio


mgr = socketio.AsyncRedisManager("redis://localhost:6379/0")
# create the async socketio server

sio = socketio.AsyncServer(
    async_mode="asgi",
    client_manager=mgr,
    cors_allowed_origins="*",  # allow the frontend to connect from any port
    logger=True,  #  Enable logs
    engineio_logger=True,  #  Enable low-level logs
)


sio_app = socketio.ASGIApp(sio, socketio_path="")
