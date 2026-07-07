import { isAxiosError } from "axios";
import { Eye, EyeOff } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { TextInput } from "../components/ui/TextInput";
import { useAuth } from "../context/AuthContext";

type LoginError = {
  tone: "danger" | "neutral";
  message: string;
  disableSubmit?: boolean;
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  const [flash] = useState<string | null>(
    (location.state as { flash?: string } | null)?.flash ?? null,
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      if (isAxiosError(err)) {
        if (err.response?.status === 401) {
          setError({ tone: "danger", message: "Invalid email or password." });
        } else if (err.response?.status === 429) {
          setError({
            tone: "danger",
            message: "Too many attempts. Try again in a few minutes.",
            disableSubmit: true,
          });
        } else if (!err.response) {
          setError({
            tone: "neutral",
            message: "Couldn't reach the server. Check your connection and try again.",
          });
        } else {
          setError({ tone: "danger", message: "Something went wrong. Please try again." });
        }
      } else {
        setError({ tone: "danger", message: "Something went wrong. Please try again." });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = Boolean(email && password) && !error?.disableSubmit;

  return (
    <div className="flex min-h-screen items-start justify-center bg-bg-app px-4 pt-12 sm:items-center sm:pt-0">
      <div className="flex w-full max-w-[400px] flex-col items-center">
        <div className="mb-6 flex items-center gap-2">
          <span className="h-6 w-6 rounded-full bg-accent" />
          <span className="text-base font-semibold text-text-primary">Realtime Chat</span>
        </div>

        <div className="w-full rounded-xl border border-border bg-bg-raised p-6 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.3),0_4px_6px_-2px_rgba(0,0,0,0.2)] sm:p-8">
          <h1 className="text-2xl font-bold text-text-primary">Log in</h1>
          <p className="mt-2 text-sm text-text-secondary">Welcome back</p>

          {flash && (
            <p className="mt-4 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-[13px] text-text-primary">
              {flash}
            </p>
          )}

          <form className="mt-6 flex flex-col" onSubmit={handleSubmit}>
            <div className="mb-4">
              <TextInput
                label="Email"
                type="email"
                name="email"
                autoFocus
                autoComplete="username"
                placeholder="you@example.com"
                value={email}
                disabled={submitting}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <TextInput
              label="Password"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              value={password}
              disabled={submitting}
              onChange={(e) => setPassword(e.target.value)}
              rightElement={
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-text-muted transition-colors hover:text-text-primary"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              }
            />

            <div className="mb-6 mt-1 min-h-[18px] text-[13px]">
              {error && (
                <p className={error.tone === "danger" ? "text-danger" : "text-text-secondary"}>
                  {error.message}
                </p>
              )}
            </div>

            <Button type="submit" isLoading={submitting} disabled={!canSubmit}>
              Log in
            </Button>
          </form>

          <p className="mt-4 text-sm text-text-secondary">
            New here?{" "}
            <Link to="/register" className="text-accent-tint hover:underline">
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
