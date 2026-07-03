import { useEffect, useLayoutEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/ChatContext";
import { SkeletonRow } from "../../components/ui/Skeleton";
import { groupMessages } from "./groupMessages";
import { MessageGroup } from "./MessageGroup";

export function MessageList() {
  const { user } = useAuth();
  const {
    activeRoomId,
    messagesByRoom,
    loadOlderMessages,
    editMessage,
    deleteMessage,
    retryMessage,
  } = useChat();

  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number | null>(null);
  const prevMessageCountRef = useRef(0);

  const roomState = activeRoomId ? messagesByRoom[activeRoomId] : undefined;
  const messages = roomState?.messages ?? [];
  const groups = groupMessages(messages);

  // Cursor-pagination trigger: scrolling to the top loads older messages.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = containerRef.current;
    if (!sentinel || !container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && roomState?.hasMore && !roomState.loading) {
          prevScrollHeightRef.current = container.scrollHeight;
          loadOlderMessages();
        }
      },
      { root: container, threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadOlderMessages, roomState?.hasMore, roomState?.loading]);

  // Preserve scroll position when older messages are prepended; scroll to
  // bottom on initial room load / new own messages.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (prevScrollHeightRef.current !== null) {
      const delta = container.scrollHeight - prevScrollHeightRef.current;
      container.scrollTop = delta;
      prevScrollHeightRef.current = null;
    } else if (messages.length !== prevMessageCountRef.current) {
      const wasNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      if (prevMessageCountRef.current === 0 || wasNearBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  // Reset on room switch so the initial load scrolls to bottom fresh.
  useEffect(() => {
    prevMessageCountRef.current = 0;
  }, [activeRoomId]);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto bg-bg-app px-4 py-4">
      <div ref={sentinelRef} />
      {roomState?.loading && roomState.messages.length > 0 && (
        <div className="mb-2">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      )}
      <div className="flex flex-col gap-4">
        {groups.map((group, i) => (
          <MessageGroup
            key={`${group.senderId}-${i}`}
            group={group}
            isOwn={group.senderId === user?.id}
            onEdit={(messageId) => {
              const message = group.messages.find((m) => m.id === messageId);
              if (!message?.content) return;
              const next = window.prompt("Edit message", message.content);
              if (next && next.trim()) editMessage(messageId, next.trim());
            }}
            onDelete={(messageId) => deleteMessage(messageId)}
            onRetry={(clientId) => retryMessage(clientId)}
          />
        ))}
      </div>
    </div>
  );
}
