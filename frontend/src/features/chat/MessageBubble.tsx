import { Edit3, FileText, Trash2 } from "lucide-react";
import { formatMessageTime } from "../../lib/formatTime";
import type { ChatMessage } from "../../types/chat";

// Image/file rendering branches below are reachable in schema (MessageOut.type)
// but currently unreachable from this client — no upload endpoint exists yet
// (see Composer.tsx paperclip). Built anyway since they're cheap presentational
// branches, kept forward-compatible with backend work landing later.
interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onRetry?: () => void;
}

export function MessageBubble({ message, isOwn, onEdit, onDelete, onRetry }: MessageBubbleProps) {
  const time = formatMessageTime(message.created_at);
  const failed = message.status === "failed";

  const bubbleRadius = isOwn ? "rounded-xl rounded-tr-[4px]" : "rounded-xl rounded-tl-[4px]";
  const bubbleTone = isOwn ? "bg-accent/15 text-text-primary" : "bg-bg-raised text-text-primary";

  return (
    <div className={`group flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
      <div className={`flex items-center gap-2 ${isOwn ? "flex-row-reverse" : ""}`}>
        {isOwn && !message.is_deleted && (
          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={onEdit}
              aria-label="Edit message"
              className="text-text-muted hover:text-text-primary"
            >
              <Edit3 size={16} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete message"
              className="text-text-muted hover:text-danger"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}

        <div
          className={`max-w-[420px] px-3 py-2 ${bubbleRadius} ${
            message.is_deleted ? "bg-bg-elevated" : bubbleTone
          } ${failed ? "opacity-60" : ""}`}
        >
          {message.is_deleted ? (
            <p className="text-sm italic text-text-muted">This message was deleted</p>
          ) : message.type === "image" && message.attachment_url ? (
            <button type="button" className="block overflow-hidden rounded-md p-1">
              <img
                src={message.attachment_url}
                alt="Attachment"
                className="max-h-[200px] max-w-[280px] rounded-md object-cover"
              />
            </button>
          ) : message.type === "file" && message.attachment_url ? (
            <a
              href={message.attachment_url}
              className="flex items-center gap-2 rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary hover:bg-bg-raised"
            >
              <FileText size={16} className="text-text-muted" />
              <span className="truncate">{message.attachment_url.split("/").pop()}</span>
            </a>
          ) : (
            <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
          )}
        </div>
      </div>

      <div className={`mt-1 flex items-center gap-1 text-[11px] text-text-muted ${isOwn ? "pr-1" : "pl-1"}`}>
        <span>{time}</span>
        {message.is_edited && !message.is_deleted && <span>(edited)</span>}
      </div>

      {failed && (
        <p className="mt-1 text-[12px] text-danger">
          Failed to send ·{" "}
          <button type="button" onClick={onRetry} className="underline hover:text-danger-hover">
            Retry
          </button>
        </p>
      )}
    </div>
  );
}
