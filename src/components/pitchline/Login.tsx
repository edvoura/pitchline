import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Zap, Mail, Lock, ShieldCheck, ArrowRight } from "lucide-react";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState<"password" | "magic-link">("password");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address.");
      return;
    }

    setLoading(true);
    try {
      if (method === "password") {
        if (!password) {
          toast.error("Please enter your password.");
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Successfully logged in.");
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        setSent(true);
        toast.success("Magic link sent to your email!");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to authenticate.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-[380px] rounded-xl border border-border bg-surface p-6 shadow-2xl animate-slide-up">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/logo.png" alt="Pitchline" className="mb-2 h-10 w-auto object-contain" />
          <p className="text-xs text-muted-foreground mt-1">
            Operator console for Trendtactics Digital
          </p>
        </div>

        {sent ? (
          <div className="space-y-4 text-center py-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-status-won/10 text-status-won">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h2 className="text-sm font-semibold">Check your inbox</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We sent a secure magic login link to <span className="text-foreground font-medium">{email}</span>. Click the link to access the cockpit.
            </p>
            <button
              onClick={() => setSent(false)}
              className="mt-2 text-xs font-semibold text-primary hover:underline"
            >
              Back to login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@trendtactics.com"
                  required
                  className="h-10 w-full rounded-md border border-input bg-input pl-10 pr-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-ring"
                />
              </div>
            </div>

            {method === "password" && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="h-10 w-full rounded-md border border-input bg-input pl-10 pr-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-ring"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full h-10 items-center justify-center gap-1.5 rounded-md bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40"
            >
              {loading ? "Authenticating…" : method === "password" ? "Login" : "Send Magic Link"}
              <ArrowRight className="h-4 w-4" />
            </button>

            <div className="flex items-center justify-between pt-2 border-t border-border/40">
              <button
                type="button"
                onClick={() =>
                  setMethod(method === "password" ? "magic-link" : "password")
                }
                className="text-xs text-muted-foreground hover:text-foreground transition"
              >
                Use {method === "password" ? "magic link" : "password"} instead
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
