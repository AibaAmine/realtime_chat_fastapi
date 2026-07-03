import { api } from "./api";
import type { Message, RoomDetail, RoomSummary, RoomType } from "../types/chat";

export async function getRooms(): Promise<RoomSummary[]> {
  const { data } = await api.get<RoomSummary[]>("/chat/rooms");
  return data;
}

export async function getRoomDetail(roomId: string): Promise<RoomDetail> {
  const { data } = await api.get<RoomDetail>(`/chat/rooms/${roomId}`);
  return data;
}

export async function createRoom(params: {
  type: RoomType;
  name?: string;
  member_ids: string[];
}): Promise<RoomDetail> {
  const { data } = await api.post<RoomDetail>("/chat/rooms/create", params);
  return data;
}

export async function markRoomAsRead(roomId: string): Promise<void> {
  await api.put(`/chat/rooms/${roomId}/mark-as-read`);
}

export async function getGlobalUnreadCount(): Promise<number> {
  const { data } = await api.get<{ unread_count: number }>("/chat/unread-count");
  return data.unread_count;
}

export async function getRoomMessages(
  roomId: string,
  params?: { limit?: number; beforeId?: string },
): Promise<Message[]> {
  const { data } = await api.get<Message[]>(`/chat/rooms/${roomId}/messages`, {
    params: {
      limit: params?.limit ?? 50,
      before_id: params?.beforeId,
    },
  });
  return data;
}

export async function editMessage(messageId: string, content: string): Promise<Message> {
  const { data } = await api.patch<Message>(`/chat/messages/${messageId}`, { content });
  return data;
}

export async function deleteMessage(messageId: string): Promise<void> {
  await api.delete(`/chat/messages/${messageId}/delete`);
}

export async function addRoomMember(roomId: string, userToAddId: string): Promise<void> {
  await api.post(`/chat/rooms/${roomId}/members/add`, { user_to_add_id: userToAddId });
}

export async function removeRoomMember(roomId: string, userId: string): Promise<void> {
  await api.delete(`/chat/rooms/${roomId}/members/${userId}/delete`);
}
