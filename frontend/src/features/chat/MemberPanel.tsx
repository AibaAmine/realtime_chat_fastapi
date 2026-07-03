import { useMemo } from "react";
import { useChat } from "../../context/ChatContext";
import { Avatar } from "../../components/ui/Avatar";

export function MemberPanel() {
  const { activeRoomDetail, onlineUserIds } = useChat();

  const sortedMembers = useMemo(() => {
    if (!activeRoomDetail) return [];
    return [...activeRoomDetail.members].sort((a, b) => {
      const aOnline = onlineUserIds.has(a.user.id);
      const bOnline = onlineUserIds.has(b.user.id);
      if (aOnline !== bOnline) return aOnline ? -1 : 1;
      return a.user.username.localeCompare(b.user.username);
    });
  }, [activeRoomDetail, onlineUserIds]);

  if (!activeRoomDetail) return null;

  return (
    <div className="flex h-full w-full flex-col bg-bg-elevated">
      <div className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-text-muted">
        Members · {sortedMembers.length}
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {sortedMembers.map((member) => {
          const online = onlineUserIds.has(member.user.id);
          return (
            <div key={member.user.id} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-bg-raised">
              <Avatar
                src={member.user.avatar_url}
                alt={member.user.username}
                size={32}
                presence={online ? "online" : "offline"}
              />
              <span className="truncate text-sm text-text-primary">{member.user.username}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
