# WebSocket API Documentation

## Connection

**Endpoint:** `/socket.io`  
**Protocol:** Socket.IO over WebSocket  
**Auth:** JWT token required

```python
# Connect with token
socket.connect(auth={"token": "your-jwt-token"})
```

---

## Events: Client → Server

### `join_room`

Join a chat room to receive messages.

```json
{
  "room_id": "uuid"
}
```

**Response:** `room_joined` event with online users list.

---

### `leave_room`

Leave a chat room.

```json
{
  "room_id": "uuid"
}
```

---

### `send_message`

Send a message to a room.

```json
{
  "room_id": "uuid",
  "content": "message text"
}
```

**Saved to database.** Broadcasts `new_message` to all room members.

---

### `typing_start`

Notify room members you're typing.

```json
{
  "room_id": "uuid"
}
```

**Broadcasts:** `user_typing` with `is_typing: true`

---

### `typing_stop`

Notify room members you stopped typing.

```json
{
  "room_id": "uuid"
}
```

**Broadcasts:** `user_typing` with `is_typing: false`

---

### `get_online_users`

Request list of online users in a room.

```json
{
  "room_id": "uuid"
}
```

**Response:** `online_users` event.

---

## Events: Server → Client

### `new_message`

Received when someone sends a message in your room.

```json
{
  "id": "message-uuid",
  "room_id": "room-uuid",
  "user_id": "sender-uuid",
  "content": "message text",
  "created_at": "2026-02-13T10:30:00"
}
```

---

### `user_typing`

Received when someone starts/stops typing.

```json
{
  "room_id": "room-uuid",
  "user_id": "typing-user-uuid",
  "username": "john_doe",
  "is_typing": true
}
```

---

### `user_online`

Received when a user connects.

```json
{
  "user_id": "uuid",
  "rooms": ["room1-uuid", "room2-uuid"]
}
```

---

### `user_offline`

Received when a user disconnects.

```json
{
  "user_id": "uuid",
  "rooms": ["room1-uuid", "room2-uuid"]
}
```

---

### `room_joined`

Confirmation after joining a room.

```json
{
  "room_id": "room-uuid",
  "message": "Joined room successfully",
  "online_users": ["user1-uuid", "user2-uuid"]
}
```

---

### `online_users`

Response to `get_online_users` request.

```json
{
  "room_id": "room-uuid",
  "users": ["user1-uuid", "user2-uuid"]
}
```

---

### `error`

Error notifications.

```json
{
  "message": "error description"
}
```

---

## Notes

- All `room_id` and `user_id` values are UUIDs
- Must join room before sending messages
- Online status persists across all user's rooms
- Typing events don't persist (broadcast only)
- Messages are stored in database with edit/delete support via REST API
