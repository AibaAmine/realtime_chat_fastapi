import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";
import { useMediaQuery } from "../lib/useMediaQuery";
import { EmptyState } from "../components/ui/EmptyState";
import { Sidebar } from "../features/chat/Sidebar";
import { ConversationHeader } from "../features/chat/ConversationHeader";
import { MessageList } from "../features/chat/MessageList";
import { TypingIndicator } from "../features/chat/TypingIndicator";
import { Composer } from "../features/chat/Composer";
import { MemberPanel } from "../features/chat/MemberPanel";

type MobileView = "list" | "conversation" | "members";

export default function MainChatPage() {
  const { user } = useAuth();
  const { activeRoomId, activeRoomDetail, typingByRoom, sendMessage, setTyping } = useChat();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [mobileView, setMobileView] = useState<MobileView>("list");
  const [membersOpen, setMembersOpen] = useState(false);

  // Per-room member panel open/closed persistence.
  useEffect(() => {
    if (!activeRoomId) return;
    const saved = localStorage.getItem(`chat:memberPanel:${activeRoomId}`);
    setMembersOpen(saved === "true");
  }, [activeRoomId]);

  function toggleMembers() {
    if (!activeRoomId) return;
    const next = !membersOpen;
    setMembersOpen(next);
    localStorage.setItem(`chat:memberPanel:${activeRoomId}`, String(next));
    if (isMobile && next) setMobileView("members");
  }

  const roomTitle = activeRoomDetail
    ? activeRoomDetail.type === "group"
      ? "#" + (activeRoomDetail.name ?? "group")
      : (activeRoomDetail.members.find((m) => m.user.id !== user?.id)?.user.username ?? "")
    : "";

  const isGroup = activeRoomDetail?.type === "group";
  const typingUsers = activeRoomId ? typingByRoom[activeRoomId] ?? [] : [];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg-app">
      <div
        className={`w-full shrink-0 border-r border-border md:w-[280px] ${
          isMobile ? (mobileView === "list" ? "block" : "hidden") : "block"
        }`}
      >
        <Sidebar onSelectRoom={() => setMobileView("conversation")} />
      </div>

      <div
        className={`flex min-w-0 flex-1 flex-col ${
          isMobile ? (mobileView === "conversation" ? "flex" : "hidden") : "flex"
        }`}
      >
        {activeRoomId && activeRoomDetail ? (
          <>
            <ConversationHeader
              membersOpen={membersOpen}
              onToggleMembers={toggleMembers}
              onBack={() => setMobileView("list")}
            />
            <MessageList />
            <TypingIndicator users={typingUsers} />
            <Composer
              roomLabel={roomTitle || "room"}
              onSend={sendMessage}
              onTypingChange={setTyping}
            />
          </>
        ) : (
          <EmptyState
            icon={MessageSquare}
            title="Select a conversation"
            description="Pick a room from the sidebar to start chatting."
          />
        )}
      </div>

      {isGroup && membersOpen && (
        <div
          className={`w-full shrink-0 border-l border-border md:w-[240px] ${
            isMobile ? (mobileView === "members" ? "block" : "hidden") : "block"
          }`}
        >
          <MemberPanel />
        </div>
      )}
    </div>
  );
}
