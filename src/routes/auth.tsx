import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertCircle, Trophy } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import logoAsset from "@/assets/gridiron-gods-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { mode?: "login" | "signup" } =>
    search['mode'] === "login" ? { mode: "login" } : {},
  head: () => ({
    meta: [
      { title: "Log in — Gridiron Gods" },
      { name: "description", content: "Log in or create your Gridiron Gods account." },
      { property: "og:title", content: "Log in — Gridiron Gods" },
      { property: "og:description", content: "Log in or create your Gridiron Gods account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode: initialMode } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">(initialMode ?? "signup");
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/leagues", replace: true });
    });
  }, [navigate]);

  /** Phone numbers become a stable internal address so no text message is needed. */
  function phoneAccountEmail(value: string) {
    const digits = value.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15)
      throw new Error("Enter your phone number with country code, like +1 415 555 0134.");
    return `${digits}@phone.gridirongods.app`;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const identifier = method === "phone" ? phoneAccountEmail(phone) : email;
      if (mode === "login") {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: identifier,
          password,
        });
        if (err) throw err;
        navigate({ to: "/leagues", replace: true });
      } else {
        if (username.trim().length < 3) throw new Error("Username must be at least 3 characters.");
        const { data, error: err } = await supabase.auth.signUp({
          email: identifier,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              username: username.trim(),
              ...(method === "phone" ? { phone_number: phone.trim() } : {}),
            },
          },
        });
        if (err) throw err;
        if (data.session) navigate({ to: "/leagues", replace: true });
        else if (method === "phone")
          setNotice("Account created. Log in with your phone number and password.");
        else setNotice("Check your email to confirm your account, then log in.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function googleSignIn() {
    setError("");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError("Google sign-in didn't work. Try again or use your email.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/leagues", replace: true });
  }

  const resetFlow = () => {
    setError("");
    setNotice("");
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <img
            src={logoAsset.url}
            alt="Gridiron Gods"
            className="mx-auto h-16 w-16 rounded-lg object-cover"
          />
          <h1 className="mt-4 text-3xl font-semibold uppercase">Gridiron Gods</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick winners straight up. Beat your league.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-5 flex gap-1 rounded-md bg-secondary p-1">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  resetFlow();
                }}
                className={`flex-1 rounded py-2 text-sm font-medium transition-colors ${
                  mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                {m === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>

          <div className="mb-5 flex gap-1 rounded-md bg-secondary p-1">
            {(["email", "phone"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMethod(m);
                  resetFlow();
                }}
                className={`flex-1 rounded py-2 text-sm font-medium transition-colors ${
                  method === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                {m === "email" ? "Email" : "Phone number"}
              </button>
            ))}
          </div>

          <form onSubmit={submit}>
            {method === "email" ? (
              <>
                <label className="field-label" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mb-4 w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </>
            ) : (
              <>
                <label className="field-label" htmlFor="phone">
                  Phone number
                </label>
                <input
                  id="phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 415 555 0134"
                  className="mb-1 w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="mb-4 text-xs text-faint">Include your country code, like +1. No text message needed.</p>
              </>
            )}

            {mode === "signup" && (
              <>
                <label className="field-label" htmlFor="username">
                  Username
                </label>
                <input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="how your league sees you"
                  className="mb-4 w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </>
            )}

            <label className="field-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mb-4 w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />






            {error && (
              <div className="mb-3 flex items-start gap-2 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {notice && (
              <div className="mb-3 rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-soft-foreground">
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-85 disabled:opacity-40"
            >
              {mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-faint">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={googleSignIn}
            className="w-full rounded-md border border-border-strong bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
          >
            Continue with Google
          </button>
        </div>

        <p className="mt-5 text-center text-xs text-faint">
          <Link to="/">Back to home</Link>
        </p>
      </div>
    </main>
  );
}
