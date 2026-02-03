from sqlalchemy.orm import Session
from db_models.chat import Message, Room, RoomMember, RoomType
from fastapi import HTTPException
from uuid import UUID
from typing import List
from sqlalchemy import select, and_, func, join, or_
from db_models.user import User
from datetime import datetime


class ChatService:

    @staticmethod
    def mark_as_read(db: Session, room_id: UUID, user_id: UUID):

        room_member = (
            db.query(RoomMember)
            .filter(RoomMember.room_id == room_id, RoomMember.user_id == user_id)
            .first()
        )
        if not room_member:
            raise HTTPException(404, "user is not a member ")

        room_member.last_read_at = datetime.now()
        db.commit()
        db.refresh(room_member)

        return {
            "message": "Room marked as read",
            "room_id": str(room_id),
            "last_read_at": room_member.last_read_at,
        }

    @staticmethod
    def get_room_by_id(db: Session, room_id: UUID, user_id: UUID):
        room = (
            db.query(Room)
            .join(RoomMember, Room.id == RoomMember.room_id)
            .filter(Room.id == room_id, RoomMember.user_id == user_id)
            .first()
        )

        if not room:
            raise HTTPException(
                404, "Room not found or you are not a member of this room "
            )
        return room

    @staticmethod
    def get_user_rooms(db: Session, user_id: UUID):
        """
        Get all rooms for a user, sorted by most recent message activity.
        """
        # Subquery: Get the latest message timestamp for each room
        latest_message_subquery = (
            select(
                Message.room_id, func.max(Message.created_at).label("last_message_time")
            )
            .group_by(Message.room_id)
            .subquery()
        )

        unread_count_subquery = select(RoomMember.room_id)

        unread_count_subquery = (
            select(Message.room_id, func.count(Message.id).label("unread_count"))
            .join(RoomMember, Message.room_id == RoomMember.room_id)
            .where(
                and_(
                    RoomMember.user_id == user_id,
                    or_(
                        RoomMember.last_read_at.is_(None),
                        Message.created_at > RoomMember.last_read_at,
                    ),
                )
            )
            .group_by(Message.room_id)
            .subquery()  # Turn this into a subquery (a temporary table) that I can join with the main query.
        )

        # Main query: Get rooms with latest message time for sorting
        rooms = (
            db.query(
                Room,
                func.coalesce(unread_count_subquery.c.unread_count, 0).label(
                    "unread_count"
                ),  # if room = NULL (room  has no unread messages), convert it to 0
            )
            .join(RoomMember, Room.id == RoomMember.room_id)
            .outerjoin(
                latest_message_subquery, Room.id == latest_message_subquery.c.room_id
            )
            .outerjoin(
                unread_count_subquery, Room.id == unread_count_subquery.c.room_id
            )
            .filter(RoomMember.user_id == user_id, Room.is_active == True)
            .order_by(latest_message_subquery.c.last_message_time.desc().nullslast())
            .all()
        )

        # get latest messsages for all rooms for previews

        # we could just get the msg for each room but to avoid N+1 problem we do :

        room_ids = [room.id for room, _ in rooms]
        # get the timestamp of the latest msg for each room (first db access)
        max_created_subquery = (
            db.query(
                Message.room_id, func.max(Message.created_at).label("max_created_at")
            )
            .filter(Message.room_id.in_(room_ids))
            .group_by(Message.room_id)
            .subquery()
        )

        # get the full message objs that match the past timestamps (secong db access)

        latest_messages_list = (
            db.query(Message)
            .join(
                max_created_subquery,
                (Message.room_id == max_created_subquery.c.room_id)
                & (Message.created_at == max_created_subquery.c.max_created_at),
            )
            .all()
        )

        # convert to dict
        latest_messages = {msg.room_id: msg for msg in latest_messages_list}

        # Attach the data to room objects
        result = []
        for room, unread_count in rooms:
            room.unread_count = unread_count
            room.last_message = latest_messages.get(
                room.id
            )  # Get the message for THIS room
            result.append(room)

        return result

    @staticmethod
    # if the room is dm and the room allready exist it will return it
    def create_room(
        db: Session,
        user_id: UUID,
        type: str = None,
        name: str = None,
        participant_ids: List[UUID] = None,
    ):
        if participant_ids is None:
            participant_ids = []

        # first check if the participants_ids are valid
        all_user_ids = {user_id}
        all_user_ids.update(participant_ids)

        existing_users = db.query(User.id).filter(User.id.in_(all_user_ids)).all()
        existing_user_ids = {u.id for u in existing_users}

        invalid_ids = all_user_ids - existing_user_ids
        if invalid_ids:
            raise HTTPException(400, f"Invalid user IDs: {invalid_ids}")

        if type == RoomType.DM:
            if len(participant_ids) != 1:
                raise HTTPException(
                    400, "DM must have exactly one participant (the other user)."
                )

            if participant_ids[0] == user_id:
                raise HTTPException(400, "You cannot create a DM with yourself.")

            existing_room = ChatService.get_existing_dm_room(
                db, user_id, participant_ids[0]
            )
            if existing_room:
                return existing_room
            name = None

        if type == RoomType.GROUP and not name:
            raise HTTPException(status_code=400, detail="Group chats must have a name")

        # Create the Room
        new_room = Room(type=type, name=name, creator_id=user_id, is_active=True)
        db.add(new_room)
        db.commit()
        db.refresh(new_room)

        #  Add Members
        db_members = [
            RoomMember(room_id=new_room.id, user_id=uid) for uid in all_user_ids
        ]

        db.add_all(db_members)
        db.commit()

        return new_room

    @staticmethod
    def update_room(db: Session, room_id: UUID, user_id: UUID, room_data):

        room = db.query(Room).filter(Room.id == room_id).first()

        if not room:
            raise HTTPException(404, "Room not found")

        if room.type != RoomType.GROUP:
            raise HTTPException(400, "Can only update group rooms")

        #  Only creator can update
        if room.creator_id != user_id:
            raise HTTPException(403, "Only the room creator can update the room")

        # Update fields
        if room_data.name is not None:
            room.name = room_data.name

        db.commit()
        db.refresh(room)

        return room

    @staticmethod
    def delete_room(db: Session, room_id: UUID, user_id: UUID):

        room = db.query(Room).filter(Room.id == room_id).first()

        if not room:
            raise HTTPException(404, "Room not found")

        if room.type != RoomType.GROUP:
            raise HTTPException(400, "Can only delete group rooms")

        #  Only creator can delete
        if room.creator_id != user_id:
            raise HTTPException(403, "Only the room creator can delete the room")

        # Soft delete
        room.is_active = False

        db.commit()

    @staticmethod
    def get_existing_dm_room(db: Session, user_id: UUID, other_user_id: UUID):
        "find a room of type dm where both users are members"

        query = (
            select(Room)
            .join(RoomMember, Room.id == RoomMember.room_id)
            .where(
                Room.type == RoomType.DM,
                RoomMember.user_id.in_([user_id, other_user_id]),
            )
            .group_by(Room.id)
            .having(func.count(RoomMember.user_id) == 2)
        )

        return db.execute(query).scalars().first()

    @staticmethod
    def get_global_unread_count(db: Session, user_id: UUID):

        count = (
            db.query(func.count(Message.id))
            .join(RoomMember, Message, RoomMember.room_id == Message.room_id)
            .filter(
                RoomMember.user_id == user_id,
                or_(
                    RoomMember.last_read_at.is_(
                        None
                    ),  # thats mean he did not open the room
                    Message.created_at > RoomMember.last_read_at,
                ),
            )
            .scalar()  # returns a single value
        )
        return count or 0

    @staticmethod
    def edit_message(db: Session, message_id: UUID, user_id: UUID, new_content: str):

        message = db.query(Message).filter(Message.id == message_id).first()

        if not message:
            raise HTTPException(404, "Message not found")

        # only sender can edit

        if message.sender_id != user_id:
            raise HTTPException(403, "You can only edit your own messages")

        # update content
        message.content = new_content
        message.is_edited = True
        db.commit()
        db.refresh(message)

        return message

    @staticmethod
    def delete_message(db: Session, user_id: UUID, message_id: UUID):

        message = db.query(Message).filter(Message.id == message_id).first()
        if not message:
            raise HTTPException(404, "Message not found")
        if message.sender_id != user_id:
            raise HTTPException(403, "You can only edit your own messages")

        message.content = "This message is deleted"
        message.is_deleted = True
        db.commit()
        db.refresh(message)

    @staticmethod
    def add_member(db: Session, room_id: UUID, user_id: UUID, user_to_add_id: UUID):
        # see if the room exist and its type is GROUP
        # check if he is allready a memeber in that room
        # add him if exists to room member table

        room = db.query(Room).filter(Room.id == room_id).first()
        if not room:
            raise HTTPException(404, "Room not found")

        if room.type != RoomType.GROUP:
            raise HTTPException(404, "you can only add members to group rooms")

        # better to change this (when implementing admins options in groups)
        if room.creator_id != user_id:
            raise HTTPException(404, "only the room creator can add members ")

        user_to_add = db.query(User).filter(User.id == user_to_add_id).first()
        if not user_to_add:
            raise HTTPException(404, "User not found")

        # check if the user to add already exists in the room
        existing = (
            db.query(RoomMember)
            .filter(RoomMember.room_id == room_id, RoomMember.user_id == user_to_add_id)
            .first()
        )
        if existing:
            raise HTTPException(404, "User allready exist in that room")

        # add memeber
        new_member = RoomMember(room_id=room_id, user_id=user_to_add_id)
        db.add(new_member)
        db.commit()

    @staticmethod
    def remove_member(db: Session, room_id: UUID, creator_id: UUID, user_id: UUID):

        room = db.query(Room).filter(Room.id == room_id).first()

        if not room:
            raise HTTPException(404, "Room not found")

        if room.type != RoomType.GROUP:
            raise HTTPException(400, "Can only remove members from group rooms")

        #  Only creator can remove members (change this when implementing the admins feature )
        if room.creator_id != creator_id:
            raise HTTPException(403, "Only the room creator can remove members")

        # Can't remove the creator
        if user_id == creator_id:
            raise HTTPException(400, "Cannot remove the room creator")

        # Remove member
        member = (
            db.query(RoomMember)
            .filter(RoomMember.room_id == room_id, RoomMember.user_id == user_id)
            .first()
        )

        if not member:
            raise HTTPException(404, "User is not a member of this room")

        db.delete(member)
        db.commit()
