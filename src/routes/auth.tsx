import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import "@lovable.dev/cloud-auth-js/styles.css";

import { NeonLogo } from "@/components/neon/neon-logo";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to Neon" },
      { name: "description", content: "Sign in or create an account to chat with Neon, the AI assistant." },
      { property: "og:title", content: "Sign in to Neon" },
      { property: "og:description", content: "Sign in or create an account to chat with Neon." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/chat", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/chat", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { display_name: name.trim() } },
        });
        if (error) throw error;
        if (!data.session) setCheckEmail(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const social = async (provider: "google" | "lovable") => {
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error(result.error.message ?? "Sign in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/chat", replace: true });
  };

  return (
    <div className="neon-canvas flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <NeonLogo className="mb-4 size-14" />
          <h1 className="text-3xl font-semibold tracking-tight">
            {mode === "signin" ? "Welcome back to " : "Meet "}
            <span className="neon-text">Neon</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Your AI assistant, in three speeds.</p>
        </div>

        <div className="composer-shell rounded-3xl p-6">
          {checkEmail ? (
            <div className="space-y-3 text-center">
              <h2 className="text-lg font-semibold">Check your email</h2>
              <p className="text-sm text-muted-foreground">
                We sent a confirmation link to <span className="text-foreground">{email}</span>. Open it to finish creating your account.
              </p>
              <button type="button" className="text-sm text-primary hover:underline" onClick={() => { setCheckEmail(false); setMode("signin"); }}>
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => social("google")}
                  className="flex h-11 w-full items-center justify-center gap-3 rounded-full bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90"
                >
                  <GoogleMark />
                  Continue with Google
                </button>
                <button type="button" className="lovable-auth-button w-full" onClick={() => social("lovable")}>
                  Continue with Lovable
                </button>
              </div>

              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                or
                <div className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={submit} className="space-y-3">
                {mode === "signup" ? (
                  <AuthInput label="Name" value={name} onChange={setName} autoComplete="name" required />
                ) : null}
                <AuthInput label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
                <AuthInput
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                  minLength={6}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="h-11 w-full rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
                </button>
              </form>
            </>
          )}
        </div>

        {!checkEmail ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "New to Neon? " : "Already have an account? "}
            <button type="button" className="font-medium text-primary hover:underline" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function AuthInput({
  label,
  value,
  onChange,
  ...props
}: { label: string; value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        {...props}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-input bg-background/60 px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
      />
    </label>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
