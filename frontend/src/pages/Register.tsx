import { isAxiosError } from "axios";
import { Eye, EyeOff } from "lucide-react";
import { useState, type FocusEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { TextInput } from "../components/ui/TextInput";
import { useAuth } from "../context/AuthContext";

type FormError = {
  tone: "danger" | "neutral";
  message: string;
  disableSubmit?: boolean;
  showLoginLink?: boolean;
};

const USERNAME_HINT = "3–50 characters, letters, numbers, underscore only";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,50}$/;

function usernameError(value: string): string | null {
  if (!value) return "Username is required";
  if (!USERNAME_REGEX.test(value)) return USERNAME_HINT;
  return null;
}

function emailError(value: string): string | null {
  if (!value) return "Email is required";
  if (!EMAIL_REGEX.test(value)) return "Enter a valid email address";
  return null;
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState({ username: false, email: false });
  const [formError, setFormError] = useState<FormError | null>(null);

  const usernameMsg = usernameError(username);
  const emailMsg = emailError(email);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasLength = password.length >= 8;
  const passwordValid = hasUpper && hasDigit && hasLength;

  const showUsernameError = (touched.username || submitAttempted) && Boolean(usernameMsg);
  const showEmailError = (touched.email || submitAttempted) && Boolean(emailMsg);

  const canSubmit =
    !usernameMsg && !emailMsg && passwordValid && !submitting && !formError?.disableSubmit;

  function handleBlur(field: "username" | "email") {
    return (_e: FocusEvent<HTMLInputElement>) => {
      setTouched((t) => ({ ...t, [field]: true }));
    };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    if (usernameMsg || emailMsg || !passwordValid || submitting) return;

    setSubmitting(true);
    setFormError(null);

    try {
      await register(username, email, password);
      navigate("/");
    } catch (err) {
      if (isAxiosError(err)) {
        if (err.response?.status === 400) {
          setFormError({
            tone: "danger",
            message: "That username or email is already taken.",
            showLoginLink: true,
          });
        } else if (err.response?.status === 429) {
          setFormError({
            tone: "danger",
            message: "Too many attempts. Try again in a few minutes.",
            disableSubmit: true,
          });
        } else if (err.response?.status === 422) {
          setFormError({
            tone: "danger",
            message: "Please check your details and try again.",
          });
        } else if (!err.response) {
          setFormError({
            tone: "neutral",
            message: "Couldn't reach the server. Check your connection and try again.",
          });
        } else {
          setFormError({ tone: "danger", message: "Something went wrong. Please try again." });
        }
      } else {
        setFormError({ tone: "danger", message: "Something went wrong. Please try again." });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-bg-app px-4 pt-12 sm:items-center sm:pt-0">
      <div className="flex w-full max-w-[400px] flex-col items-center">
        <div className="mb-6 flex items-center gap-2">
          <span className="h-6 w-6 rounded-full bg-accent" />
          <span className="text-base font-semibold text-text-primary">Realtime Chat</span>
        </div>

        <div className="w-full rounded-xl border border-border bg-bg-raised p-6 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.3),0_4px_6px_-2px_rgba(0,0,0,0.2)] sm:p-8">
          <h1 className="text-2xl font-bold text-text-primary">Create account</h1>
          <p className="mt-2 text-sm text-text-secondary">Join the conversation</p>

          <form className="mt-6 flex flex-col" onSubmit={handleSubmit}>
            <div className="mb-1">
              <TextInput
                label="Username"
                type="text"
                name="username"
                autoFocus
                autoComplete="username"
                placeholder="yourname"
                value={username}
                disabled={submitting}
                error={showUsernameError}
                onBlur={handleBlur("username")}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <p
              className={`mb-4 mt-1 text-xs ${showUsernameError ? "text-danger" : "text-text-muted"}`}
            >
              {showUsernameError ? usernameMsg : USERNAME_HINT}
            </p>

            <div className="mb-1">
              <TextInput
                label="Email"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                disabled={submitting}
                error={showEmailError}
                onBlur={handleBlur("email")}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {showEmailError && <p className="mb-4 mt-1 text-xs text-danger">{emailMsg}</p>}
            {!showEmailError && <div className="mb-4" />}

            <TextInput
              label="Password"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="new-password"
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
            <p
              className={`mt-1 text-xs ${passwordValid ? "text-success" : "text-text-muted"}`}
            >
              At least 8 characters, one uppercase letter, and one number.
            </p>

            <div className="mb-6 mt-4 min-h-[18px] text-[13px]">
              {formError && (
                <p className={formError.tone === "danger" ? "text-danger" : "text-text-secondary"}>
                  {formError.message}{" "}
                  {formError.showLoginLink && (
                    <Link to="/login" className="text-accent-tint hover:underline">
                      Log in
                    </Link>
                  )}
                </p>
              )}
            </div>

            <Button type="submit" isLoading={submitting} disabled={!canSubmit}>
              Create account
            </Button>
          </form>

          <p className="mt-4 text-sm text-text-secondary">
            Already have an account?{" "}
            <Link to="/login" className="text-accent-tint hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
