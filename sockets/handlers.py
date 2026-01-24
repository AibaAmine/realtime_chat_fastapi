from urllib.parse import parse_qs
from core.socket_manager import sio
from core.security import decode_token


async def handle_connect(sid, environ, auth):
    # Extract Token (Auth dict or Query Param)
    token = None
    if auth and "token" in auth:
        token = auth["token"]
    else:
        query_string = environ.get("QUERY_STRING", "")
        params = parse_qs(query_string)
        if "token" in params:
            token = params["token"][0]
  
    if not token:
        return False

    # Validate Token
    payload = decode_token(token)
    if not payload:
        return False

    user_id = payload.get("sub")
    if not user_id:
        return False

    #  Save Session
    await sio.save_session(sid, {"user_id": user_id})
    print(f"User {user_id} connected")
    return True


async def handle_disconnect(sid):
    print(f"Client {sid} disconnected")
