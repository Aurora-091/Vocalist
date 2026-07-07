import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ShieldCheck, Phone, Zap, Loader as Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { WeeberLogo } from "../components/WeeberLogo";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { trackSignupConversion } from "../lib/analytics";

const signupSchema = z.object({
  orgName: z.string().min(2, "Organization name must be at least 2 characters."),
  email: z.email("Please enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Z]/, "Password needs at least one uppercase letter.")
    .regex(/[0-9]/, "Password needs at least one number."),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function Signup() {
  const navigate = useNavigate();

  useEffect(() => {
    const meta = document.querySelector('meta[name="robots"]');
    const prev = meta?.getAttribute("content") || "";
    meta?.setAttribute("content", "noindex, nofollow");
    return () => { meta?.setAttribute("content", prev); };
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { orgName: "", email: "", password: "" },
  });

  async function submit(data: SignupFormValues) {
    const { data: result, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { org_name: data.orgName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    trackSignupConversion();
    if (result.session) {
      navigate("/dashboard?welcome=1");
    } else {
      navigate(`/auth/verify?email=${encodeURIComponent(data.email)}`);
    }
  }

  async function signUpWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard?welcome=1`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) toast.error(error.message);
  }

  return (
    <div className="marketing min-h-full flex flex-col lg:flex-row">
      {/* Left panel - value prop */}
      <div className="hidden lg:flex lg:w-[45%] bg-[#0F172A] text-white p-12 flex-col justify-between">
        <div>
          <Link to="/" className="inline-flex items-center">
            <WeeberLogo size="md" inverted />
          </Link>
        </div>
        <div>
          <h1 className="text-3xl xl:text-4xl font-bold leading-[1.1] tracking-tight mb-6">
            Voice AI that handles
            <br />
            real calls for your business.
          </h1>
          <div className="space-y-4">
            <Feature icon={Phone} text="Inbound and outbound, one platform" />
            <Feature icon={ShieldCheck} text="TCPA compliance built in from day one" />
            <Feature icon={Zap} text="First call live in under 10 minutes" />
          </div>
        </div>
        <div className="text-sm text-[#64748B]">
          Trusted by 340+ businesses. SOC 2 in progress.
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:py-0">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center lg:hidden mb-8">
            <WeeberLogo size="md" />
          </Link>

          <h2 className="text-2xl font-semibold tracking-tight text-[#0F172A] mb-1">
            Create your account
          </h2>
          <p className="text-sm text-[#475569] mb-8">
            Start placing real calls in under 10 minutes. No credit card.
          </p>

          <button
            type="button"
            onClick={signUpWithGoogle}
            className="w-full flex items-center justify-center gap-3 h-12 px-4 border border-[#E2E8F0] bg-white hover:bg-[#F0EDE4] transition-colors text-sm font-medium text-[#0F172A]"
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
                Organization name
              </label>
              <input
                {...register("orgName")}
                className="w-full h-12 px-4 border border-[#E2E8F0] bg-white text-[#0F172A] text-sm placeholder:text-[#94A3B8] focus:outline-none focus:border-[#111] transition-colors"
                placeholder="Bloom Dental"
              />
              {errors.orgName && (
                <p className="mt-1 text-xs text-red-600">{errors.orgName.message}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-1.5">
                Work email
              </label>
              <input
                type="email"
                {...register("email")}
                className="w-full h-12 px-4 border border-[#E2E8F0] bg-white text-[#0F172A] text-sm placeholder:text-[#94A3B8] focus:outline-none focus:border-[#111] transition-colors"
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
              <input
                type="password"
                {...register("password")}
                className="w-full h-12 px-4 border border-[#E2E8F0] bg-white text-[#0F172A] text-sm placeholder:text-[#94A3B8] focus:outline-none focus:border-[#111] transition-colors"
                placeholder="8+ characters"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-[#0F172A] text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#1E293B] transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Create account
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-4 text-xs text-[#64748B] text-center">
            By creating an account you agree to our{" "}
            <Link to="/terms" className="underline hover:text-[#475569]">Terms</Link> and{" "}
            <Link to="/privacy" className="underline hover:text-[#475569]">Privacy Policy</Link>.
          </p>

          <div className="mt-8 pt-6 border-t border-[#E2E8F0] text-sm text-[#475569]">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-[#0F172A] hover:underline">
              Sign in
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
