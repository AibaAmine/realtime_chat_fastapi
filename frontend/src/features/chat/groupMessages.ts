import type { ChatMessage } from "../../types/chat";

export interface MessageGroup {
  senderId: string;
  messages: ChatMessage[];
}

const GROUP_WINDOW_MS = 5 * 60 * 1000;

// Consecutive messages from the same sender within a short window group
// together (avatar/name shown once per spec).
export function groupMessages(messages: ChatMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];

  for (const message of messages) {
    const last = groups[groups.length - 1];
    const lastMessage = last?.messages[last.messages.length - 1];
    const withinWindow =
      lastMessage &&
      new Date(message.created_at).getTime() - new Date(lastMessage.created_at).getTime() <
        GROUP_WINDOW_MS;

    if (last && last.senderId === message.sender.id && withinWindow) {
      last.messages.push(message);
    } else {
      groups.push({ senderId: message.sender.id, messages: [message] });
    }
  }

  return groups;
}
