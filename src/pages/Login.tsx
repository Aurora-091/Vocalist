import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, Phone, ShieldCheck, Zap, Loader as Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { api } from "../lib/api";
import { appUrl, isAppDomain } from "../lib/hostname";
import { WeeberLogo } from "../components/WeeberLogo";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL || "";
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD || "";

const loginSchema = z.object({
  email: z.email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function submit(data: LoginFormValues) {
    try {
      const result = await api.post<{
        session: { access_token: string; refresh_token: string };
        user: { id: string };
      }>("/v1/auth/login", data);
      if (result.session) {
        await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        });
        if (isAppDomain) {
          navigate("/dashboard");
        } else {
          window.location.href = `${appUrl("/auth/bridge?redirect=/dashboard")}#access_token=${result.session.access_token}&refresh_token=${result.session.refresh_token}`;
        }
      }
    } catch {
      toast.error("That email and password didn't match. Try again.");
    }
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: appUrl("/auth/bridge?redirect=/dashboard"),
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) toast.error(error.message);
  }

  function loginAsDemo() {
    if (!DEMO_EMAIL || !DEMO_PASSWORD) {
      toast.error("Demo account not configured.");
      return;
    }
    setDemoLoading(true);
    api.post<{
      session: { access_token: string; refresh_token: string };
    }>("/v1/auth/login", { email: DEMO_EMAIL, password: DEMO_PASSWORD }).then(async (result) => {
      if (result.session) {
        await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        });
        if (isAppDomain) {
          navigate("/dashboard");
        } else {
          window.location.href = `${appUrl("/auth/bridge?redirect=/dashboard")}#access_token=${result.session.access_token}&refresh_token=${result.session.refresh_token}`;
        }
      }
      setDemoLoading(false);
    }).catch(() => {
      setDemoLoading(false);
      toast.error("Demo account not available. Please sign up.");
    });
  }

  return (
    <div className="marketing min-h-full flex flex-col lg:flex-row">
      {/* Left panel — always dark by design */}
      <div className="hidden lg:flex lg:w-[45%] bg-[#111] text-white p-12 flex-col justify-between">
        <div>
          <Link to="/" className="inline-flex items-center">
            <WeeberLogo size="md" inverted />
          </Link>
        </div>
        <div>
          <h1 className="text-3xl xl:text-4xl font-bold leading-[1.1] tracking-tight mb-6">
            Welcome back.
            <br />
            <span className="text-white/50">Your agents are ready.</span>
          </h1>
          <div className="space-y-4">
            <Feature icon={Phone} text="Inbound and outbound, one platform" />
            <Feature icon={ShieldCheck} text="TCPA compliance built in from day one" />
            <Feature icon={Zap} text="First call live in under 10 minutes" />
          </div>
        </div>
        <div className="text-sm text-white/40">
          Trusted by 340+ businesses. SOC 2 in progress.
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:py-0 bg-[#F8F9FB]">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center lg:hidden mb-8">
            <WeeberLogo size="md" />
          </Link>

          <h2 className="text-2xl font-semibold tracking-tight text-[#0F172A] mb-1">
            Sign in
          </h2>
          <p className="text-sm text-[#475569] mb-8">
            Welcome back to Weeber.
          </p>

          <button
            type="button"
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 h-12 px-4 border border-[#E2E8F0] bg-white hover:bg-[#F8F9FB] transition-colors text-sm font-medium text-[#0F172A] rounded-md"
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
              <div className="w-full border-t border-[#E2E8F0]" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-[#F8F9FB] text-xs text-[#64748B] uppercase tracking-widest">
                or
              </span>
            </div>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit(submit)}>
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-1.5">
                Email
              </label>
              <input
                type="email"
                {...register("email")}
                className="w-full h-12 px-4 border border-[#E2E8F0] bg-white text-[#0F172A] text-sm placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F172A] rounded-md transition-colors"
                placeholder="you@company.com"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  {...register("password")}
                  className="w-full h-12 px-4 pr-12 border border-[#E2E8F0] bg-white text-[#0F172A] text-sm placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F172A] rounded-md transition-colors"
                  placeholder="Your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-[#0F172A] text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#1E293B] rounded-md transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Demo account card */}
          {DEMO_EMAIL && DEMO_PASSWORD && (
            <div className="mt-6 border border-[#E2E8F0] bg-[#F1F5F9] p-4 rounded-md">
              <div className="text-xs font-medium tracking-widest uppercase text-[#64748B] mb-2">
                Try Weeber instantly
              </div>
              <p className="text-sm text-[#475569] mb-3">
                Explore the full platform with pre-loaded data.
              </p>
              <button
                onClick={loginAsDemo}
                disabled={demoLoading || isSubmitting}
                className="w-full h-10 border border-[#E2E8F0] bg-white text-[#0F172A] text-sm font-medium rounded-md hover:bg-[#F8F9FB] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {demoLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Login as Demo Account
              </button>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-[#E2E8F0] text-sm text-[#475569]">
            New to Weeber?{" "}
            <Link to="/signup" className="font-medium text-[#0F172A] hover:underline">
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
    <div className="flex items-center gap-3 text-sm text-white/70">
      <Icon className="w-4 h-4 text-white/40 shrink-0" />
      {text}
    </div>
  );
}
