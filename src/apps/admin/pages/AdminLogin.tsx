import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const result = await api.post<{
        session: { access_token: string; refresh_token: string };
        user: { id: string };
      }>("/v1/auth/login", { email, password });

      if (!result.session?.access_token) {
        setErr("Login failed. No session returned.");
        setLoading(false);
        return;
      }

      const token = result.session.access_token;

      await supabase.auth.setSession({
        access_token: token,
        refresh_token: result.session.refresh_token,
      });

      const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
      const meRes = await fetch(`${BASE_URL}/v1/admin/me`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!meRes.ok) {
        await supabase.auth.signOut();
        if (meRes.status === 403) {
          setErr("You don't have access to the Weeber Admin Portal.");
        } else {
          setErr("Admin verification failed. Please contact support.");
        }
        setLoading(false);
        return;
      }

      const access = await meRes.json();
      if (access.platform_role !== "super_admin") {
        await supabase.auth.signOut();
        setErr("You don't have access to the Weeber Admin Portal.");
        setLoading(false);
        return;
      }

      navigate("/");
    } catch {
      setErr("Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-10">
          <img
            src="/weeber_favicon_transparent.png"
            alt="Weeber"
            className="h-8 w-8 object-contain invert"
          />
          <span className="text-xs font-bold tracking-widest uppercase text-[#6B7280]">
            Internal Portal
          </span>
        </div>

        <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
          Platform Admin
        </h1>
        <p className="text-sm text-[#6B7280] mb-8">
          Access restricted to the Weeber team.
        </p>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <Label className="text-[#9CA3AF] text-sm">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="bg-[#141414] border-[#2A2A2A] text-white placeholder:text-[#4B5563] focus-visible:ring-[#3B82F6]/30 focus-visible:border-[#3B82F6]"
              placeholder="you@weeber.ai"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[#9CA3AF] text-sm">Password</Label>
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-[#141414] border-[#2A2A2A] text-white placeholder:text-[#4B5563] focus-visible:ring-[#3B82F6]/30 focus-visible:border-[#3B82F6] pr-10"
                placeholder="Enter password"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-white transition-colors"
                tabIndex={-1}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {err && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
              {err}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-[#0A0A0A] hover:bg-[#E5E7EB] font-semibold h-10"
          >
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <p className="mt-10 text-center text-xs text-[#4B5563]">
          Not a team member?{" "}
          <a
            href="https://weeber.ai"
            className="text-[#6B7280] hover:text-white underline transition-colors"
          >
            Go to weeber.ai
          </a>
        </p>
      </div>
    </div>
  );
}
