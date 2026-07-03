import { Avatar } from "../../components/ui/Avatar";
import { formatMessageTime } from "../../lib/formatTime";
import { MessageBubble } from "./MessageBubble";
import type { MessageGroup as MessageGroupType } from "./groupMessages";

interface MessageGroupProps {
  group: MessageGroupType;
  isOwn: boolean;
  onEdit: (messageId: string) => void;
  onDelete: (messageId: string) => void;
  onRetry: (clientId: string) => void;
}

export function MessageGroup({ group, isOwn, onEdit, onDelete, onRetry }: MessageGroupProps) {
  const first = group.messages[0];

  return (
    <div className={`flex flex-col gap-1 ${isOwn ? "items-end" : "items-start"}`}>
      {!isOwn && (
        <div className="mb-1 flex items-center gap-2 pl-1">
          <Avatar src={first.sender.avatar_url} alt={first.sender.username} size={32} />
          <span className="text-sm font-semibold text-text-primary">{first.sender.username}</span>
          <span className="text-[11px] text-text-muted">{formatMessageTime(first.created_at)}</span>
        </div>
      )}
      <div className={`flex flex-col gap-1 ${!isOwn ? "pl-10" : ""}`}>
        {group.messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isOwn={isOwn}
            onEdit={() => onEdit(message.id)}
            onDelete={() => onDelete(message.id)}
            onRetry={() => message.clientId && onRetry(message.clientId)}
          />
        ))}
      </div>
    </div>
  );
}
