import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { ProfileForm } from "../features/profile/ProfileForm";

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-bg-app px-4 py-12">
      <div className="mx-auto mb-4 max-w-[560px]">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft size={16} />
          Back to chat
        </Link>
      </div>
      <div className="mx-auto max-w-[560px]">
        <ProfileForm />
      </div>
    </div>
  );
}
