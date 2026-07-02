import { useAuth } from "../context/AuthContext";

export default function Home() {
  const { logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg-app text-text-primary">
      <p>You're logged in.</p>
      <button
        onClick={() => void logout()}
        className="h-10 rounded-md border border-border px-4 text-text-primary hover:bg-bg-elevated"
      >
        Log out
      </button>
    </div>
  );
}
