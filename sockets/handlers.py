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

    #  Mark user online in Redis
    from core.redis_manager import set_user_online

    await set_user_online(user_id)

    # Get all rooms user is member of
    from sockets.helpers import get_user_rooms
    from core.database import SessionLocal

    db = SessionLocal()
    try:
        rooms = await get_user_rooms(user_id, db)

        # Broadcast user_online to all their rooms
        for room_id in rooms:
            await sio.emit(
                "user_online",
                {"user_id": str(user_id), "message": "User came online"},
                to=room_id,
            )
    finally:
        db.close()
    return True


async def handle_disconnect(sid):
    """Handle user disconnecting"""
    db = None
    try:
        session = await sio.get_session(sid)
        user_id = session.get("user_id")

        if not user_id:
            return

        # Mark user offline in Redis
        from core.redis_manager import set_user_offline

        await set_user_offline(user_id)

        #  Get all rooms user was member of
        from sockets.helpers import get_user_rooms
        from core.database import SessionLocal

        db = SessionLocal()
        try:
            rooms = await get_user_rooms(user_id, db)

            # Broadcast user_offline to all their rooms
            for room_id in rooms:
                await sio.emit(
                    "user_offline",
                    {"user_id": str(user_id), "message": "User went offline"},
                    to=room_id,
                )
        finally:
            db.close()

        print(f"User {user_id} disconnected")

    except Exception as e:
        print(f"Error in disconnect: {e}")


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

            #  Get online users
            from sockets.helpers import get_online_users_in_room

            online_users = await get_online_users_in_room(room_id, db)

            # Send confirmation
            await sio.emit(
                "room_joined",
                {
                    "room_id": str(room_id),
                    "message": "Successfully joined room",
                    "online_users": online_users,
                },
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


async def handle_send_message(sid, data):
    db = None

    try:
        session = await sio.get_session(sid)
        user_id = session.get("user_id")

        if not user_id:
            await sio.emit("error", {"message": "unauthorized"}, to=sid)
            return

        room_id = data.get("room_id")
        content = data.get("content")

        if not room_id:
            await sio.emit("error", {"message": "room_id is required"}, to=sid)
            return

        if not content:
            await sio.emit("error", {"message": "content is required"}, to=sid)
            return

        if len(content.strip()) == 0:
            await sio.emit(
                "error", {"message": "message content cannot be empty"}, to=sid
            )
            return

        # Validate UUID format
        try:
            UUID(room_id)
        except ValueError:
            await sio.emit("error", {"message": "Invalid room_id format"}, to=sid)
            return

        # Database operations
        from core.database import SessionLocal
        from db_models.chat import RoomMember, Message
        from sqlalchemy.exc import SQLAlchemyError
        from datetime import datetime

        db = SessionLocal()
        try:
            # Check if user is member of room
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

            # Create message
            message = Message(
                room_id=room_id,
                sender_id=user_id,
                content=content.strip(),
                created_at=datetime.utcnow(),
            )

            db.add(message)
            db.commit()
            db.refresh(message)

            # Broadcast to room
            await sio.emit(
                "new_message",
                {
                    "id": str(message.id),
                    "room_id": str(message.room_id),
                    "user_id": str(message.sender_id),
                    "content": message.content,
                    "created_at": message.created_at.isoformat(),
                },
                to=str(room_id),  # Send to all in room
            )

            print(f"User {user_id} sent message to room {room_id}")

        except SQLAlchemyError as db_error:
            print(f"Database error in send_message: {db_error}")
            db.rollback()
            await sio.emit("error", {"message": "Failed to send message"}, to=sid)

        finally:
            if db:
                db.close()

    except Exception as e:
        print(f"Error in send_message: {e}")
        await sio.emit("error", {"message": "Failed to send message"}, to=sid)


async def handle_get_online_users(sid, data):
    """Handle request to get online users in a room"""
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

        # Validate UUID format
        try:
            UUID(room_id)
        except ValueError:
            await sio.emit("error", {"message": "Invalid room_id format"}, to=sid)
            return

        from core.database import SessionLocal
        from sockets.helpers import get_online_users_in_room

        db = SessionLocal()

        online_users = await get_online_users_in_room(room_id, db)

        await sio.emit(
            "online_users", {"room_id": str(room_id), "users": online_users}, to=sid
        )

        print(f"User {user_id} requested online users for room {room_id}")

    except Exception as e:
        print(f"Error in get_online_users: {e}")
        await sio.emit("error", {"message": "Failed to get online users"}, to=sid)

    finally:
        if db:
            db.close()
