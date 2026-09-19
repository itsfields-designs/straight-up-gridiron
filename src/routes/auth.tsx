import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertCircle, ChevronLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { readInvite } from "@/lib/invite";
import logoAsset from "@/assets/gridiron-gods-logo.png.asset.json";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({
  staticData: { sitemap: true },
  validateSearch: (search: Record<string, unknown>): { mode?: "login" | "signup" } =>
    search['mode'] === "login" ? { mode: "login" } : {},
  loaderDeps: ({ search }) => ({ mode: search.mode ?? "signup" }),
  loader: ({ deps }) => ({ mode: deps.mode }),
  head: ({ loaderData }) => {
    const login = loaderData?.mode === "login";
    const title = login ? "Log in to Gridiron Gods" : "Sign up for Gridiron Gods";
    const description = login
      ? "Log in to make your weekly NFL picks and check your league standings."
      : "Create your free Gridiron Gods account and start an NFL pick'em league with friends.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: "https://gridirongods.app/auth" },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: "https://gridirongods.app/auth" }],
    };
  },
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
  const [showPassword, setShowPassword] = useState(false);

  /** An invite link opened before signing in continues where it left off. */
  function afterAuth() {
    const invite = readInvite();
    if (invite) {
      navigate({
        to: "/join/$code",
        params: { code: invite.code },
        search: invite.ref ? { ref: invite.ref } : {},
        replace: true,
      });
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) afterAuth();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        afterAuth();
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
        if (data.session) afterAuth();
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
    afterAuth();
  }

  const resetFlow = () => {
    setError("");
    setNotice("");
  };

  async function forgotPassword() {
    resetFlow();
    if (method === "phone") {
      setError("Password reset is available for email accounts. Phone accounts can still log in with their current password.");
      return;
    }
    if (!email.trim()) {
      setError("Enter your email address first, then choose Forgot password.");
      return;
    }
    setBusy(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth?mode=login`,
    });
    setBusy(false);
    if (resetError) setError(resetError.message);
    else setNotice("Check your email for a password reset link.");
  }

  const fieldClass = "h-[52px] w-full rounded-xl border-2 border-border bg-card px-4 text-base outline-none transition-shadow placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/20";

  return (
    <main className="min-h-screen bg-secondary px-0 py-0 sm:px-5 sm:py-8">
      <div className="mx-auto min-h-screen w-full max-w-[720px] overflow-hidden border-border-strong bg-background sm:min-h-0 sm:rounded-[30px] sm:border">
        <header className="relative flex h-[70px] items-center justify-center bg-primary px-5 text-primary-foreground">
          <Link to="/" aria-label="Back to home" className="absolute left-5 grid h-11 w-11 place-items-center rounded-full transition-colors hover:bg-primary-foreground/10">
            <ChevronLeft size={29} />
          </Link>
          <Link to="/" className="flex items-center gap-3">
            <img src={logoAsset.url} alt="" className="h-11 w-11 rounded-xl object-cover" />
            <span className="font-display text-[1.6rem] font-semibold uppercase leading-none sm:text-[2rem]">Gridiron Gods</span>
          </Link>
        </header>

        <div className="px-5 pb-8 pt-6 sm:px-8 sm:pb-10 sm:pt-10">
          <h1 className={`whitespace-nowrap font-display font-semibold leading-none ${mode === "login" ? "text-[3rem] sm:text-[4.25rem]" : "text-[2.35rem] sm:text-[4.25rem]"}`}>
            {mode === "login" ? "Log in" : "Create your account"}
          </h1>
          <p className="mt-3 text-lg text-muted-foreground sm:text-xl">Pick winners straight up. Beat your league.</p>

          <div className="mt-6 flex rounded-xl bg-secondary p-1" role="tablist" aria-label="Account action">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m);
                  resetFlow();
                }}
                className={`h-[52px] flex-1 rounded-[10px] text-base font-semibold transition-colors ${
                  mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>

          <Button type="button" variant="outline" onClick={googleSignIn} className="mt-4 h-[52px] w-full rounded-xl border-2 border-border bg-card text-base font-semibold shadow-none hover:bg-secondary">
            <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-full border-2 border-border font-display text-sm text-foreground">G</span>
            Continue with Google
          </Button>

          <div className="my-5 flex items-center gap-4 text-sm text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or use <span className="h-px flex-1 bg-border" />
          </div>

          <div className="flex border-b border-border" role="tablist" aria-label="Sign-in method">
            {(["email", "phone"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={method === m}
                onClick={() => {
                  setMethod(m);
                  resetFlow();
                }}
                className={`relative min-h-12 px-0 pr-7 text-left text-base font-semibold transition-colors ${
                  method === m ? "text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-1 after:bg-accent" : "text-muted-foreground"
                }`}
              >
                {m === "email" ? "Email" : "Phone number"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-4">
            {method === "email" ? (
              <>
                <label className="field-label" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={`${fieldClass} mb-5`}
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
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 415 555 0134"
                  className={`${fieldClass} mb-2`}
                />
                <p className="mb-5 px-0.5 text-sm leading-5 text-muted-foreground">
                  Include your country code. You’ll use this number with your password—no text message is sent.
                </p>
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
                  className={`${fieldClass} mb-2`}
                />
                <p className="mb-5 px-0.5 text-sm text-muted-foreground">Your league sees this. You can change it later.</p>
              </>
            )}

            <label className="field-label" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "login" ? "Your password" : "Choose a password"}
                className={`${fieldClass} pr-20`}
              />
              <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-0 min-w-16 px-3 text-sm font-semibold text-muted-foreground">
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {mode === "login" && (
              <div className="mt-3 text-right">
                <button type="button" onClick={forgotPassword} className="min-h-11 text-base font-semibold text-primary underline underline-offset-4">
                  Forgot password?
                </button>
              </div>
            )}
            {error && (
              <div role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-destructive-soft px-3 py-2.5 text-sm text-destructive">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {notice && (
              <div role="status" aria-live="polite" className="mt-3 rounded-lg bg-accent-soft px-3 py-2.5 text-sm text-accent-soft-foreground">
                {notice}
              </div>
            )}

            <Button
              type="submit"
              disabled={busy}
              className="mt-5 h-[52px] w-full rounded-xl bg-accent font-display text-xl font-semibold text-accent-foreground shadow-none hover:bg-accent/90"
            >
              {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
