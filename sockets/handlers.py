from urllib.parse import parse_qs
from core.socket_manager import sio
from core.security import decode_token
from uuid import UUID


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


async def handle_join_room(sid, data):
    """Handle user joining a room"""

    db = None
    try:
        session = await sio.get_session(sid)
        user_id = session.get("user_id")

        if not user_id:
            await sio.emit("error", {"message": "unauthorized"}, to=sid)
            return

        room_id = data.get("room_id")
        if not room_id:
            await sio.emit("error", {"message": "room_id is required"}, to=sid)
            return

        try:
            UUID(room_id)  # Will throw if invalid UUID
        except ValueError:
            await sio.emit("error", {"message": "Invalid room_id format"}, to=sid)
            return

        # Validate membership
        from core.database import SessionLocal
        from db_models.chat import RoomMember
        from sqlalchemy.exc import SQLAlchemyError

        db = SessionLocal()
        try:
            member = (
                db.query(RoomMember)
                .filter(RoomMember.room_id == room_id, RoomMember.user_id == user_id)
                .first()
            )

            if not member:
                await sio.emit(
                    "error", {"message": "You are not a member of this room"}, to=sid
                )
                return

            # Join the SocketIO room
            await sio.enter_room(sid, str(room_id))

            # Send confirmation
            await sio.emit(
                "room_joined",
                {"room_id": str(room_id), "message": "Successfully joined room"},
                to=sid,
            )

            print(f"User {user_id} joined room {room_id}")

        except SQLAlchemyError as db_error:
            print(f"Database error in join_room: {db_error}")
            await sio.emit("error", {"message": "Database error occurred"}, to=sid)

        finally:
            if db:
                db.close()

    except Exception as e:
        print(f"Error in join_room: {e}")
        await sio.emit("error", {"message": "Failed to join room"}, to=sid)


async def handle_leave_room(sid, data):
    """Handle user leaving a room"""
    db = None
    try:
        session = await sio.get_session(sid)
        user_id = session.get("user_id")

        if not user_id:
            await sio.emit("error", {"message": "unauthorized"}, to=sid)
            return

        room_id = data.get("room_id")
        if not room_id:
            await sio.emit("error", {"message": "room_id is required"}, to=sid)
            return

        # Validate membership before leaving
        from core.database import SessionLocal
        from db_models.chat import RoomMember
        from sqlalchemy.exc import SQLAlchemyError

        db = SessionLocal()
        try:
            member = (
                db.query(RoomMember)
                .filter(RoomMember.room_id == room_id, RoomMember.user_id == user_id)
                .first()
            )

            if not member:
                await sio.emit(
                    "error", {"message": "You are not a member of this room"}, to=sid
                )
                return

            # Leave the SocketIO room
            await sio.leave_room(sid, str(room_id))

            # Send confirmation
            await sio.emit(
                "room_left",
                {"room_id": str(room_id), "message": "Successfully left room"},
                to=sid,
            )

            print(f"User {user_id} left room {room_id}")
        except SQLAlchemyError as db_error:
            print(f"Database error in leave_room: {db_error}")
            await sio.emit("error", {"message": "Database error occurred"}, to=sid)

        finally:
            if db:
                db.close()

    except Exception as e:
        print(f"Error in leave_room: {e}")
        await sio.emit("error", {"message": "Failed to leave room"}, to=sid)


