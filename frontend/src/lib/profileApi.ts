import { api } from "./api";
import type { ProfileResponse, ProfileUpdatePayload } from "../types/profile";

export async function getMyProfile(): Promise<ProfileResponse> {
  const { data } = await api.get<ProfileResponse>("/profile/me");
  return data;
}

export async function updateMyProfile(payload: ProfileUpdatePayload): Promise<ProfileResponse> {
  const { data } = await api.patch<ProfileResponse>("/profile/me/", payload);
  return data;
}

export async function uploadAvatar(file: File): Promise<{ avatar_url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post<{ avatar_url: string }>("/profile/me/avatar", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteAvatar(): Promise<void> {
  await api.delete("/profile/me/avatar");
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  await api.post("/auth/change-password", {
    old_password: oldPassword,
    new_password: newPassword,
  });
}
