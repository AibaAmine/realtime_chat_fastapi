import { ChevronLeft, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/ChatContext";
import { Avatar } from "../../components/ui/Avatar";

interface ConversationHeaderProps {
  membersOpen: boolean;
  onToggleMembers: () => void;
  onBack: () => void;
}

export function ConversationHeader({ membersOpen, onToggleMembers, onBack }: ConversationHeaderProps) {
  const { user } = useAuth();
  const { activeRoomDetail, onlineUserIds } = useChat();

  if (!activeRoomDetail) return null;

  const isGroup = activeRoomDetail.type === "group";
  const partner = !isGroup
    ? activeRoomDetail.members.find((m) => m.user.id !== user?.id)?.user
    : undefined;
  const title = isGroup ? activeRoomDetail.name ?? "Group" : partner?.username ?? "Direct message";
  const partnerOnline = partner ? onlineUserIds.has(partner.id) : false;

  return (
    <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-bg-elevated px-4">
      <button type="button" onClick={onBack} className="text-text-muted hover:text-text-primary md:hidden">
        <ChevronLeft size={20} />
      </button>

      {!isGroup && partner && <Avatar src={partner.avatar_url} alt={partner.username} size={32} />}

      <div className="flex flex-col">
        <span className="text-lg font-semibold text-text-primary">{title}</span>
        {!isGroup && (
          <span className="flex items-center gap-1.5 text-xs text-text-muted">
            <span className={`h-1.5 w-1.5 rounded-full ${partnerOnline ? "bg-success" : "bg-text-muted"}`} />
            {partnerOnline ? "Online" : "Offline"}
          </span>
        )}
      </div>

      <div className="flex-1" />

      {isGroup && (
        <button
          type="button"
          onClick={onToggleMembers}
          aria-pressed={membersOpen}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-sm ${
            membersOpen ? "text-accent" : "text-text-muted hover:text-text-primary"
          }`}
        >
          <Users size={18} />
          {activeRoomDetail.members.length} members
        </button>
      )}
    </div>
  );
}
