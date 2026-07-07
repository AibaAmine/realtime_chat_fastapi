// Mirrors schemas/profile.py::ProfileResponse
export interface ProfileResponse {
  id: string;
  user_id: string;
  bio: string | null;
  avatar_url: string | null;
  status: string | null;
  phone_number: string | null;
  date_of_birth: string | null;
  location: string | null;
  created_at: string;
  updated_at: string | null;
}

// Mirrors schemas/profile.py::ProfileUpdate — only the fields this page edits
export interface ProfileUpdatePayload {
  bio?: string | null;
  status?: string | null;
}
