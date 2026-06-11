import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, Phone, ShieldCheck, Zap } from "lucide-react";
import { supabase } from "../lib/supabase";
import { api } from "../lib/api";

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
    } catch {
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
    <div className="min-h-full bg-[#FAFAF8] flex flex-col lg:flex-row">
      {/* Left panel - value prop */}
      <div className="hidden lg:flex lg:w-[45%] bg-[#111] text-white p-12 flex-col justify-between">
        <div>
          <Link to="/welcome" className="font-semibold text-lg tracking-tight">
            Aurora
          </Link>
        </div>
        <div>
          <h1 className="text-3xl xl:text-4xl font-bold leading-[1.1] tracking-tight mb-6">
            Welcome back.
            <br />
            <span className="text-[#888]">Your agents are ready.</span>
          </h1>
          <div className="space-y-4">
            <Feature icon={Phone} text="Inbound and outbound, one platform" />
            <Feature icon={ShieldCheck} text="TCPA compliance built in from day one" />
            <Feature icon={Zap} text="First call live in under 10 minutes" />
          </div>
        </div>
        <div className="text-sm text-[#888]">
          Trusted by 340+ businesses. SOC 2 in progress.
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:py-0">
        <div className="w-full max-w-md">
          <Link to="/welcome" className="font-semibold text-lg tracking-tight text-[#111] lg:hidden mb-8 block">
            Aurora
          </Link>

          <h2 className="text-2xl font-semibold tracking-tight text-[#111] mb-1">
            Sign in
          </h2>
          <p className="text-sm text-[#555] mb-8">
            Welcome back to Aurora.
          </p>

          <button
            type="button"
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 h-12 px-4 border border-[#D9D5CE] bg-white hover:bg-[#F0EDE4] transition-colors text-sm font-medium text-[#111]"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#D9D5CE]" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-[#FAFAF8] text-xs text-[#888] uppercase tracking-widest">
                or
              </span>
            </div>
          </div>

          <form className="space-y-5" onSubmit={submit}>
            <div>
              <label className="block text-xs font-medium text-[#555] mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 px-4 border border-[#D9D5CE] bg-white text-[#111] text-sm placeholder:text-[#999] focus:outline-none focus:border-[#111] transition-colors"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#555] mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 px-4 pr-12 border border-[#D9D5CE] bg-white text-[#111] text-sm placeholder:text-[#999] focus:outline-none focus:border-[#111] transition-colors"
                  placeholder="Your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#888] hover:text-[#111] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {err && <div className="text-sm text-red-600">{err}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#111] text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#222] transition-colors disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {/* Demo account card */}
          <div className="mt-6 border border-[#D9D5CE] bg-[#F0EDE4] p-4">
            <div className="text-xs font-medium tracking-widest uppercase text-[#888] mb-2">
              Try Aurora instantly
            </div>
            <p className="text-sm text-[#555] mb-3">
              Explore the full platform with pre-loaded data.
            </p>
            <button
              onClick={loginAsDemo}
              disabled={loading}
              className="w-full h-10 border border-[#D9D5CE] bg-white text-[#111] text-sm font-medium hover:bg-[#FAFAF8] transition-colors disabled:opacity-50"
            >
              Login as Demo Account
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-[#D9D5CE] text-sm text-[#555]">
            New to Aurora?{" "}
            <Link to="/signup" className="font-medium text-[#111] hover:underline">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-[#ccc]">
      <Icon className="w-4 h-4 text-[#888] shrink-0" />
      {text}
    </div>
  );
}
