import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "../lib/supabase";
import { api, ApiError } from "../lib/api";
import { Button } from "../components/legacy-ui/Button";

const DEMO_EMAIL = "demo@aurora.dev";
const DEMO_PASSWORD = "aurora-demo-2026";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const result = await api.post<{
        session: { access_token: string; refresh_token: string };
        user: { id: string };
      }>("/v1/auth/login", { email, password });
      if (result.session) {
        await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        });
      }
      navigate("/");
    } catch (error: any) {
      setErr("That email and password didn't match. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    setErr(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) setErr(error.message);
  }

  function loginAsDemo() {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setErr(null);
    setLoading(true);
    api.post<{
      session: { access_token: string; refresh_token: string };
    }>("/v1/auth/login", { email: DEMO_EMAIL, password: DEMO_PASSWORD }).then(async (result) => {
      if (result.session) {
        await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        });
      }
      setLoading(false);
      navigate("/");
    }).catch(() => {
      setLoading(false);
      setErr("Demo account not available. Please sign up.");
    });
  }

  return (
    <div className="min-h-full flex items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm space-y-4">
        <div className="bg-surface border border-border rounded-md shadow-card p-6">
          <div className="font-semibold tracking-tight text-lg mb-1">Sign in</div>
          <p className="text-sm text-text-muted mb-6">Welcome back to Aurora.</p>

          <button
            type="button"
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 h-10 px-4 rounded-md border border-border bg-surface hover:bg-surface-2 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-surface text-text-muted">or sign in with email</span>
            </div>
          </div>

          <form className="space-y-4" onSubmit={submit}>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-border bg-surface"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 px-3 pr-10 rounded-md border border-border bg-surface"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {err && <div className="text-sm text-danger">{err}</div>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <div className="mt-6 text-sm text-text-muted">
            New here?{" "}
            <Link to="/signup" className="text-primary hover:text-primary-700">
              Create an account
            </Link>
          </div>
        </div>

        <div className="bg-surface border border-primary/20 rounded-md p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium tracking-widest uppercase text-primary">
              Try Aurora instantly
            </div>
          </div>
          <div className="text-sm text-text-muted mb-3">
            Use the demo account to explore all features with pre-loaded data.
          </div>
          <div className="bg-surface-2 rounded-md p-3 mb-3 font-mono text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Email:</span>
              <span className="text-text">{DEMO_EMAIL}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Password:</span>
              <span className="text-text">{DEMO_PASSWORD}</span>
            </div>
          </div>
          <Button variant="secondary" className="w-full" onClick={loginAsDemo} disabled={loading}>
            Login as Demo
          </Button>
        </div>
      </div>
    </div>
  );
}
