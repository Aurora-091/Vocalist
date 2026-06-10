import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "../lib/supabase";
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setErr("That email and password didn't match. Try again.");
      return;
    }
    navigate("/");
  }

  function loginAsDemo() {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setErr(null);
    setLoading(true);
    supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD }).then(({ error }) => {
      setLoading(false);
      if (error) {
        setErr("Demo account not available. Please sign up.");
        return;
      }
      navigate("/");
    });
  }

  return (
    <div className="min-h-full flex items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm space-y-4">
        <div className="bg-surface border border-border rounded-md shadow-card p-6">
          <div className="font-semibold tracking-tight text-lg mb-1">Sign in</div>
          <p className="text-sm text-text-muted mb-6">Welcome back to Aurora.</p>
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
              {loading ? "Signing in…" : "Sign in"}
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
