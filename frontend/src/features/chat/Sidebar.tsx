import { useEffect, useState } from "react";
import { LogOut, MessageSquare, Plus, Search } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/ChatContext";
import { EmptyState } from "../../components/ui/EmptyState";
import { Badge } from "../../components/ui/Badge";
import { RoomList } from "./RoomList";
import { NewChatModal } from "./NewChatModal";

interface SidebarProps {
  onSelectRoom: () => void;
}

export function Sidebar({ onSelectRoom }: SidebarProps) {
  const { rooms, roomsLoaded } = useChat();
  const { logout } = useAuth();
  const [showNewChat, setShowNewChat] = useState(false);

  const globalUnread = rooms.reduce((sum, r) => sum + r.unread_count, 0);

  useEffect(() => {
    document.title = globalUnread > 0 ? `(${globalUnread}) Realtime Chat` : "Realtime Chat";
  }, [globalUnread]);

  return (
    <div className="flex h-full w-full flex-col bg-bg-elevated">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="h-6 w-6 rounded-full bg-accent" />
        <span className="flex-1 text-sm font-semibold text-text-primary">Realtime Chat</span>
        <Badge count={globalUnread} />
        <button
          type="button"
          onClick={() => setShowNewChat(true)}
          aria-label="New chat"
          className="text-text-muted hover:text-text-primary"
        >
          <Plus size={18} />
        </button>
        <button
          type="button"
          onClick={() => void logout()}
          aria-label="Log out"
          className="text-text-muted hover:text-text-primary"
        >
          <LogOut size={18} />
        </button>
      </div>

      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} />}

      <div className="px-4 pb-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          {/* No search endpoint exists on the backend yet — rendered per spec, inert rather than faked. */}
          <input
            disabled
            placeholder="Search (coming soon)"
            className="h-9 w-full cursor-not-allowed rounded-md border border-border bg-bg-app pl-9 pr-3 text-sm text-text-muted placeholder:text-text-muted"
          />
        </div>
      </div>

      {roomsLoaded && rooms.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No conversations yet"
          description="Start a conversation to see it here."
        />
      ) : (
        <RoomList onSelectRoom={onSelectRoom} />
      )}
    </div>
  );
}
