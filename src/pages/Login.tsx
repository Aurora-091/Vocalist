import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Button } from "../components/legacy-ui/Button";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="min-h-full flex items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm bg-surface border border-border rounded-md shadow-card p-6">
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
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-border bg-surface"
            />
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
    </div>
  );
}
