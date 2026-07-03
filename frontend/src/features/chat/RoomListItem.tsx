import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/ChatContext";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { formatRoomTimestamp } from "../../lib/formatTime";
import type { RoomSummary } from "../../types/chat";

interface RoomListItemProps {
  room: RoomSummary;
  isActive: boolean;
  onSelect: () => void;
}

export function RoomListItem({ room, isActive, onSelect }: RoomListItemProps) {
  const { user } = useAuth();
  const { onlineUserIds } = useChat();

  const isGroup = room.type === "group";
  // DM partner isn't embedded in RoomListOut — only resolvable once the room
  // is opened (RoomDetail.members). Until then, fall back to a generic label.
  const title = isGroup ? room.name ?? "Group" : "Direct message";
  const timestamp = room.last_message
    ? formatRoomTimestamp(room.last_message.created_at)
    : formatRoomTimestamp(room.created_at);

  const isOwnLastMessage = room.last_message?.sender.id === user?.id;
  const preview = room.last_message
    ? `${isOwnLastMessage ? "You: " : ""}${room.last_message.content ?? ""}`
    : "No messages yet";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors ${
        isActive ? "bg-bg-raised" : "hover:bg-bg-raised/60"
      }`}
    >
      <Avatar
        src={null}
        alt={title}
        size={40}
        presence={!isGroup ? (room.last_message && onlineUserIds.has(room.last_message.sender.id) ? "online" : "offline") : undefined}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-text-primary">{title}</span>
          <span className="shrink-0 text-[11px] text-text-muted">{timestamp}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] text-text-secondary">{preview}</span>
          <Badge count={room.unread_count} />
        </div>
      </div>
    </button>
  );
}
