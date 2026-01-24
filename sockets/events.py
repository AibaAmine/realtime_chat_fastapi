from core.socket_manager import sio
from sockets.handlers import handle_connect, handle_disconnect


# Map the event to the handler function
@sio.on("connect")
async def on_connect(sid, environ, auth=None):
    return await handle_connect(sid, environ, auth)



@sio.on("disconnect")
async def on_disconnect(sid):
    await handle_disconnect(sid)
