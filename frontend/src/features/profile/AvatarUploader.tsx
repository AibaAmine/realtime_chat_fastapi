import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { Avatar } from "../../components/ui/Avatar";
import * as profileApi from "../../lib/profileApi";

interface AvatarUploaderProps {
  avatarUrl: string | null;
  username: string;
  onUploaded: (url: string) => void;
}

export function AvatarUploader({ avatarUrl, username, onUploaded }: AvatarUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    setPreview(avatarUrl);
  }, [avatarUrl]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Please choose an image file");
      e.target.value = "";
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setUploading(true);
    setUploadError(null);

    try {
      const { avatar_url } = await profileApi.uploadAvatar(file);
      setPreview(avatar_url);
      onUploaded(avatar_url);
    } catch {
      setPreview(avatarUrl);
      setUploadError("Upload failed, try again");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const label = avatarUrl ? "Change photo" : "Upload photo";

  return (
    <div className="flex flex-col items-center">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        aria-label={label}
        className="group relative h-24 w-24 rounded-full disabled:cursor-not-allowed"
      >
        <Avatar src={preview} alt={username} size={96} />
        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
            <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100">
            <ImageIcon size={18} />
            <span className="text-[10px] font-medium leading-tight">{label}</span>
          </div>
        )}
      </button>
      {uploadError && <p className="mt-2 text-xs text-danger">{uploadError}</p>}
    </div>
  );
}
