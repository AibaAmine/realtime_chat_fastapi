import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { useSocket } from "./SocketContext";
import * as chatApi from "../lib/chatApi";
import type {
  ChatMessage,
  Message,
  NewMessagePayload,
  OnlineUsersPayload,
  PresenceEventPayload,
  RoomDetail,
  RoomJoinedPayload,
  RoomSummary,
  SocketErrorPayload,
  UserSummary,
  UserTypingPayload,
} from "../types/chat";

// No socket ack/nack exists for send_message, so failed-send detection is a
// client-side timeout rather than a guaranteed server response.
const SEND_TIMEOUT_MS = 8000;
const MESSAGE_PAGE_SIZE = 50;
// Spec: typing indicator auto-clears ~3s after the last event with no follow-up.
const TYPING_CLEAR_MS = 3000;

interface TypingUser {
  userId: string;
  username: string;
}

interface RoomMessagesState {
  messages: ChatMessage[];
  hasMore: boolean;
  loading: boolean;
}

interface ChatState {
  rooms: RoomSummary[];
  roomsLoaded: boolean;
  activeRoomId: string | null;
  activeRoomDetail: RoomDetail | null;
  messagesByRoom: Record<string, RoomMessagesState>;
  typingByRoom: Record<string, TypingUser[]>;
  onlineUserIds: Set<string>;
}

type Action =
  | { type: "ROOMS_LOADED"; rooms: RoomSummary[] }
  | { type: "ROOM_SELECTED"; roomId: string }
  | { type: "ROOM_DETAIL_LOADED"; roomId: string; detail: RoomDetail }
  | { type: "MESSAGES_LOADING"; roomId: string }
  | { type: "MESSAGES_LOADED_INITIAL"; roomId: string; messages: Message[] }
  | { type: "MESSAGES_LOADED_OLDER"; roomId: string; messages: Message[]; hasMore: boolean }
  | { type: "MESSAGE_SEND_START"; roomId: string; message: ChatMessage }
  | { type: "MESSAGE_RECONCILED"; roomId: string; clientId: string; message: Message }
  | { type: "MESSAGE_APPENDED_REMOTE"; roomId: string; message: ChatMessage }
  | { type: "MESSAGE_SEND_FAILED"; roomId: string; clientId: string }
  | { type: "MESSAGE_EDITED"; roomId: string; message: Message }
  | { type: "MESSAGE_DELETED"; roomId: string; messageId: string }
  | { type: "TYPING_UPDATED"; roomId: string; user: TypingUser; isTyping: boolean }
  | { type: "ONLINE_USERS_SET"; users: string[] }
  | { type: "PRESENCE_CHANGED"; userId: string; isOnline: boolean }
  | { type: "ROOM_UNREAD_CLEARED"; roomId: string };

const initialState: ChatState = {
  rooms: [],
  roomsLoaded: false,
  activeRoomId: null,
  activeRoomDetail: null,
  messagesByRoom: {},
  typingByRoom: {},
  onlineUserIds: new Set(),
};

function resortRooms(rooms: RoomSummary[]): RoomSummary[] {
  return [...rooms].sort((a, b) => {
    const aTime = a.last_message?.created_at ?? a.created_at;
    const bTime = b.last_message?.created_at ?? b.created_at;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });
}

function toChatMessage(message: Message, status: ChatMessage["status"] = "sent"): ChatMessage {
  return { ...message, status };
}

// Bumps a room's last_message/unread_count from an incoming message and
// re-sorts by latest activity — the single place the sidebar order updates.
function bumpRoomActivity(
  rooms: RoomSummary[],
  roomId: string,
  message: Message,
  isActiveRoom: boolean,
): RoomSummary[] {
  const updated = rooms.map((r) =>
    r.id === roomId
      ? {
          ...r,
          last_message: message,
          unread_count: isActiveRoom ? r.unread_count : r.unread_count + 1,
        }
      : r,
  );
  return resortRooms(updated);
}

function reducer(state: ChatState, action: Action): ChatState {
  switch (action.type) {
    case "ROOMS_LOADED":
      return { ...state, rooms: resortRooms(action.rooms), roomsLoaded: true };

    case "ROOM_SELECTED":
      return { ...state, activeRoomId: action.roomId, activeRoomDetail: null };

    case "ROOM_DETAIL_LOADED":
      if (state.activeRoomId !== action.roomId) return state;
      return { ...state, activeRoomDetail: action.detail };

    case "MESSAGES_LOADING":
      return {
        ...state,
        messagesByRoom: {
          ...state.messagesByRoom,
          [action.roomId]: {
            messages: state.messagesByRoom[action.roomId]?.messages ?? [],
            hasMore: state.messagesByRoom[action.roomId]?.hasMore ?? true,
            loading: true,
          },
        },
      };

    case "MESSAGES_LOADED_INITIAL": {
      // Backend returns newest-first; store oldest-first for top-to-bottom rendering.
      const messages = [...action.messages].reverse().map((m) => toChatMessage(m));
      return {
        ...state,
        messagesByRoom: {
          ...state.messagesByRoom,
          [action.roomId]: {
            messages,
            hasMore: action.messages.length === MESSAGE_PAGE_SIZE,
            loading: false,
          },
        },
      };
    }

    case "MESSAGES_LOADED_OLDER": {
      const existing = state.messagesByRoom[action.roomId];
      const older = [...action.messages].reverse().map((m) => toChatMessage(m));
      return {
        ...state,
        messagesByRoom: {
          ...state.messagesByRoom,
          [action.roomId]: {
            messages: [...older, ...(existing?.messages ?? [])],
            hasMore: action.hasMore,
            loading: false,
          },
        },
      };
    }

    case "MESSAGE_SEND_START": {
      const existing = state.messagesByRoom[action.roomId];
      const messages = [...(existing?.messages ?? []), action.message];
      return {
        ...state,
        messagesByRoom: {
          ...state.messagesByRoom,
          [action.roomId]: { messages, hasMore: existing?.hasMore ?? false, loading: false },
        },
      };
    }

    case "MESSAGE_RECONCILED": {
      const existing = state.messagesByRoom[action.roomId];
      if (!existing) return state;
      const idx = existing.messages.findIndex(
        (m) => m.status === "pending" && m.clientId === action.clientId,
      );
      if (idx === -1) return state;
      const messages = [...existing.messages];
      messages[idx] = toChatMessage(action.message, "sent");
      return {
        ...state,
        messagesByRoom: { ...state.messagesByRoom, [action.roomId]: { ...existing, messages } },
        rooms: bumpRoomActivity(state.rooms, action.roomId, action.message, true),
      };
    }

    case "MESSAGE_APPENDED_REMOTE": {
      const existing = state.messagesByRoom[action.roomId];
      const isActiveRoom = state.activeRoomId === action.roomId;
      const rooms = bumpRoomActivity(state.rooms, action.roomId, action.message, isActiveRoom);
      if (!existing) return { ...state, rooms };
      if (existing.messages.some((m) => m.id === action.message.id)) return { ...state, rooms };
      return {
        ...state,
        rooms,
        messagesByRoom: {
          ...state.messagesByRoom,
          [action.roomId]: { ...existing, messages: [...existing.messages, action.message] },
        },
      };
    }

    case "MESSAGE_SEND_FAILED": {
      const existing = state.messagesByRoom[action.roomId];
      if (!existing) return state;
      const messages = existing.messages.map((m) =>
        m.status === "pending" && m.clientId === action.clientId
          ? { ...m, status: "failed" as const }
          : m,
      );
      return {
        ...state,
        messagesByRoom: { ...state.messagesByRoom, [action.roomId]: { ...existing, messages } },
      };
    }

    case "MESSAGE_EDITED": {
      const existing = state.messagesByRoom[action.roomId];
      if (!existing) return state;
      const messages = existing.messages.map((m) =>
        m.id === action.message.id ? toChatMessage(action.message, "sent") : m,
      );
      return {
        ...state,
        messagesByRoom: { ...state.messagesByRoom, [action.roomId]: { ...existing, messages } },
      };
    }

    case "MESSAGE_DELETED": {
      const existing = state.messagesByRoom[action.roomId];
      if (!existing) return state;
      const messages = existing.messages.map((m) =>
        m.id === action.messageId
          ? { ...m, is_deleted: true, content: "This message is deleted" }
          : m,
      );
      return {
        ...state,
        messagesByRoom: { ...state.messagesByRoom, [action.roomId]: { ...existing, messages } },
      };
    }

    case "TYPING_UPDATED": {
      const existing = state.typingByRoom[action.roomId] ?? [];
      const withoutUser = existing.filter((u) => u.userId !== action.user.userId);
      const users = action.isTyping ? [...withoutUser, action.user] : withoutUser;
      return { ...state, typingByRoom: { ...state.typingByRoom, [action.roomId]: users } };
    }

    case "ONLINE_USERS_SET":
      return { ...state, onlineUserIds: new Set(action.users) };

    case "PRESENCE_CHANGED": {
      const onlineUserIds = new Set(state.onlineUserIds);
      if (action.isOnline) onlineUserIds.add(action.userId);
      else onlineUserIds.delete(action.userId);
      return { ...state, onlineUserIds };
    }

    case "ROOM_UNREAD_CLEARED":
      return {
        ...state,
        rooms: state.rooms.map((r) =>
          r.id === action.roomId ? { ...r, unread_count: 0 } : r,
        ),
      };

    default:
      return state;
  }
}

interface ChatContextValue extends ChatState {
  selectRoom: (roomId: string) => void;
  sendMessage: (content: string) => void;
  retryMessage: (clientId: string) => void;
  loadOlderMessages: () => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  setTyping: (isTyping: boolean) => void;
  refreshRooms: () => Promise<void>;
  refreshActiveRoomDetail: () => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [state, dispatch] = useReducer(reducer, initialState);

  // Refs mirroring current state, read inside socket handlers/callbacks to
  // avoid stale closures without re-registering listeners on every state change.
  const stateRef = useRef(state);
  stateRef.current = state;
  const userRef = useRef(user);
  userRef.current = user;

  // Pending optimistic sends keyed by clientId — used to match against
  // incoming new_message broadcasts (see MESSAGE_RECONCILED in the reducer).
  const pendingRef = useRef<Map<string, { roomId: string; content: string }>>(new Map());
  const sendTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const joinedRoomsRef = useRef<Set<string>>(new Set());

  const refreshRooms = useCallback(async () => {
    const rooms = await chatApi.getRooms();
    dispatch({ type: "ROOMS_LOADED", rooms });
  }, []);

  useEffect(() => {
    refreshRooms();
  }, [refreshRooms]);

  // Resolve a socket new_message payload's flat user_id into a full Message,
  // using the active room's member list (the socket event carries no sender
  // object, unlike the REST MessageOut shape).
  const resolveSender = useCallback((roomId: string, userId: string): UserSummary | null => {
    const detail = stateRef.current.activeRoomDetail;
    if (detail && detail.id === roomId) {
      const member = detail.members.find((m) => m.user.id === userId);
      if (member) return member.user;
    }
    if (userRef.current?.id === userId) return userRef.current;
    return null;
  }, []);

  useEffect(() => {
    if (!socket) return;

    const onNewMessage = (payload: NewMessagePayload) => {
      const isOwn = payload.user_id === userRef.current?.id;

      if (isOwn) {
        for (const [clientId, pending] of pendingRef.current.entries()) {
          if (pending.roomId === payload.room_id && pending.content === payload.content) {
            pendingRef.current.delete(clientId);
            const timeout = sendTimeoutsRef.current.get(clientId);
            if (timeout) clearTimeout(timeout);
            sendTimeoutsRef.current.delete(clientId);
            dispatch({
              type: "MESSAGE_RECONCILED",
              roomId: payload.room_id,
              clientId,
              message: {
                id: payload.id,
                content: payload.content,
                type: "text",
                attachment_url: null,
                sender: userRef.current as UserSummary,
                room_id: payload.room_id,
                is_edited: false,
                is_deleted: false,
                created_at: payload.created_at,
              },
            });
            return;
          }
        }
      }

      const sender = resolveSender(payload.room_id, payload.user_id);
      if (!sender) return; // sender unresolvable (not a loaded member) — drop rather than render broken data
      dispatch({
        type: "MESSAGE_APPENDED_REMOTE",
        roomId: payload.room_id,
        message: {
          id: payload.id,
          content: payload.content,
          type: "text",
          attachment_url: null,
          sender,
          room_id: payload.room_id,
          is_edited: false,
          is_deleted: false,
          created_at: payload.created_at,
          status: "sent",
        },
      });
    };

    const onRoomJoined = (payload: RoomJoinedPayload) => {
      dispatch({ type: "ONLINE_USERS_SET", users: payload.online_users });
    };

    const onOnlineUsers = (payload: OnlineUsersPayload) => {
      dispatch({ type: "ONLINE_USERS_SET", users: payload.users });
    };

    const onUserTyping = (payload: UserTypingPayload) => {
      dispatch({
        type: "TYPING_UPDATED",
        roomId: payload.room_id,
        user: { userId: payload.user_id, username: payload.username },
        isTyping: payload.is_typing,
      });
      // Spec: auto-clear ~3s after the last event with no follow-up.
      if (payload.is_typing) {
        const key = `${payload.room_id}:${payload.user_id}`;
        const existing = typingTimeoutsRef.current.get(key);
        if (existing) clearTimeout(existing);
        typingTimeoutsRef.current.set(
          key,
          setTimeout(() => {
            dispatch({
              type: "TYPING_UPDATED",
              roomId: payload.room_id,
              user: { userId: payload.user_id, username: payload.username },
              isTyping: false,
            });
            typingTimeoutsRef.current.delete(key);
          }, TYPING_CLEAR_MS),
        );
      }
    };

    const onUserOnline = (payload: PresenceEventPayload) => {
      dispatch({ type: "PRESENCE_CHANGED", userId: payload.user_id, isOnline: true });
    };

    const onUserOffline = (payload: PresenceEventPayload) => {
      dispatch({ type: "PRESENCE_CHANGED", userId: payload.user_id, isOnline: false });
    };

    const onError = (payload: SocketErrorPayload) => {
      // eslint-disable-next-line no-console
      console.error("[socket] error:", payload.message);
    };

    socket.on("new_message", onNewMessage);
    socket.on("room_joined", onRoomJoined);
    socket.on("online_users", onOnlineUsers);
    socket.on("user_typing", onUserTyping);
    socket.on("user_online", onUserOnline);
    socket.on("user_offline", onUserOffline);
    socket.on("error", onError);

    return () => {
      socket.off("new_message", onNewMessage);
      socket.off("room_joined", onRoomJoined);
      socket.off("online_users", onOnlineUsers);
      socket.off("user_typing", onUserTyping);
      socket.off("user_online", onUserOnline);
      socket.off("user_offline", onUserOffline);
      socket.off("error", onError);
    };
  }, [socket, resolveSender]);

  const selectRoom = useCallback(
    (roomId: string) => {
      dispatch({ type: "ROOM_SELECTED", roomId });
      dispatch({ type: "ROOM_UNREAD_CLEARED", roomId });

      if (socket && !joinedRoomsRef.current.has(roomId)) {
        socket.emit("join_room", { room_id: roomId });
        joinedRoomsRef.current.add(roomId);
      }

      chatApi.getRoomDetail(roomId).then((detail) => {
        dispatch({ type: "ROOM_DETAIL_LOADED", roomId, detail });
      });

      if (!stateRef.current.messagesByRoom[roomId]) {
        dispatch({ type: "MESSAGES_LOADING", roomId });
        chatApi.getRoomMessages(roomId, { limit: MESSAGE_PAGE_SIZE }).then((messages) => {
          dispatch({ type: "MESSAGES_LOADED_INITIAL", roomId, messages });
        });
      }

      chatApi.markRoomAsRead(roomId).catch(() => {});
    },
    [socket],
  );

  const loadOlderMessages = useCallback(async () => {
    const roomId = stateRef.current.activeRoomId;
    if (!roomId) return;
    const roomState = stateRef.current.messagesByRoom[roomId];
    if (!roomState || roomState.loading || !roomState.hasMore || roomState.messages.length === 0) {
      return;
    }
    dispatch({ type: "MESSAGES_LOADING", roomId });
    const oldestId = roomState.messages[0].id;
    const page = await chatApi.getRoomMessages(roomId, {
      limit: MESSAGE_PAGE_SIZE,
      beforeId: oldestId,
    });
    dispatch({
      type: "MESSAGES_LOADED_OLDER",
      roomId,
      messages: page,
      hasMore: page.length === MESSAGE_PAGE_SIZE,
    });
  }, []);

  const sendMessage = useCallback(
    (content: string) => {
      const roomId = stateRef.current.activeRoomId;
      const currentUser = userRef.current;
      if (!roomId || !socket || !currentUser || !content.trim()) return;

      const clientId = crypto.randomUUID();
      const optimistic: ChatMessage = {
        id: clientId,
        content,
        type: "text",
        attachment_url: null,
        sender: currentUser,
        room_id: roomId,
        is_edited: false,
        is_deleted: false,
        created_at: new Date().toISOString(),
        status: "pending",
        clientId,
      };
      dispatch({ type: "MESSAGE_SEND_START", roomId, message: optimistic });
      pendingRef.current.set(clientId, { roomId, content });
      socket.emit("send_message", { room_id: roomId, content });

      sendTimeoutsRef.current.set(
        clientId,
        setTimeout(() => {
          if (pendingRef.current.has(clientId)) {
            pendingRef.current.delete(clientId);
            dispatch({ type: "MESSAGE_SEND_FAILED", roomId, clientId });
          }
        }, SEND_TIMEOUT_MS),
      );
    },
    [socket],
  );

  const retryMessage = useCallback(
    (clientId: string) => {
      const roomId = stateRef.current.activeRoomId;
      if (!roomId || !socket) return;
      const roomState = stateRef.current.messagesByRoom[roomId];
      const message = roomState?.messages.find((m) => m.clientId === clientId);
      if (!message || !message.content) return;

      dispatch({
        type: "MESSAGE_SEND_START",
        roomId,
        message: { ...message, status: "pending" },
      });
      pendingRef.current.set(clientId, { roomId, content: message.content });
      socket.emit("send_message", { room_id: roomId, content: message.content });

      sendTimeoutsRef.current.set(
        clientId,
        setTimeout(() => {
          if (pendingRef.current.has(clientId)) {
            pendingRef.current.delete(clientId);
            dispatch({ type: "MESSAGE_SEND_FAILED", roomId, clientId });
          }
        }, SEND_TIMEOUT_MS),
      );
    },
    [socket],
  );

  const editMessage = useCallback(async (messageId: string, content: string) => {
    const roomId = stateRef.current.activeRoomId;
    if (!roomId) return;
    const message = await chatApi.editMessage(messageId, content);
    dispatch({ type: "MESSAGE_EDITED", roomId, message });
  }, []);

  const deleteMessage = useCallback(async (messageId: string) => {
    const roomId = stateRef.current.activeRoomId;
    if (!roomId) return;
    await chatApi.deleteMessage(messageId);
    dispatch({ type: "MESSAGE_DELETED", roomId, messageId });
  }, []);

  const refreshActiveRoomDetail = useCallback(async () => {
    const roomId = stateRef.current.activeRoomId;
    if (!roomId) return;
    const detail = await chatApi.getRoomDetail(roomId);
    dispatch({ type: "ROOM_DETAIL_LOADED", roomId, detail });
  }, []);

  const setTyping = useCallback(
    (isTyping: boolean) => {
      const roomId = stateRef.current.activeRoomId;
      if (!roomId || !socket) return;
      socket.emit(isTyping ? "typing_start" : "typing_stop", { room_id: roomId });
    },
    [socket],
  );

  return (
    <ChatContext.Provider
      value={{
        ...state,
        selectRoom,
        sendMessage,
        retryMessage,
        loadOlderMessages,
        editMessage,
        deleteMessage,
        setTyping,
        refreshRooms,
        refreshActiveRoomDetail,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
