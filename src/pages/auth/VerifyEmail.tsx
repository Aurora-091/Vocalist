import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { WeeberLogo } from "../../components/WeeberLogo";
import { usePageTitle } from "../../hooks/usePageTitle";
import { toast } from "sonner";
import { Mail, ArrowRight, Loader as Loader2 } from "lucide-react";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 30;

export default function VerifyEmail() {
  usePageTitle("Verify your email \u00b7 Weeber");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const verify = useCallback(
    async (code: string) => {
      if (code.length !== CODE_LENGTH || verifying) return;
      setVerifying(true);
      setError(null);

      const { error: err } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "signup",
      });

      if (err) {
        setError(err.message);
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setDigits(Array(CODE_LENGTH).fill(""));
          inputRefs.current[0]?.focus();
        }, 500);
        setVerifying(false);
        return;
      }

      navigate("/dashboard?welcome=1", { replace: true });
    },
    [email, navigate, verifying]
  );

  function handleChange(index: number, value: string) {
    if (verifying) return;
    const sanitized = value.replace(/\D/g, "");

    if (sanitized.length > 1) {
      const pasted = sanitized.slice(0, CODE_LENGTH).split("");
      const newDigits = [...digits];
      pasted.forEach((d, i) => {
        if (index + i < CODE_LENGTH) newDigits[index + i] = d;
      });
      setDigits(newDigits);
      const nextIdx = Math.min(index + pasted.length, CODE_LENGTH - 1);
      inputRefs.current[nextIdx]?.focus();

      const fullCode = newDigits.join("");
      if (fullCode.length === CODE_LENGTH) verify(fullCode);
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = sanitized;
    setDigits(newDigits);

    if (sanitized && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    const fullCode = newDigits.join("");
    if (fullCode.length === CODE_LENGTH && !newDigits.includes("")) {
      verify(fullCode);
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      const newDigits = [...digits];
      newDigits[index - 1] = "";
      setDigits(newDigits);
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setResendCooldown(RESEND_COOLDOWN);
    const { error: err } = await supabase.auth.resend({
      type: "signup",
      email,
    });
    if (err) {
      toast.error(err.message);
    } else {
      toast.success("Verification email sent.");
    }
  }

  if (!email) {
    return (
      <div className="min-h-full flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-sm text-[#475569]">No email address specified.</p>
          <Link to="/signup" className="text-sm font-medium text-[#0F172A] hover:underline mt-2 inline-block">
            Go to signup
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="marketing min-h-full flex flex-col lg:flex-row">
      <div className="hidden lg:flex lg:w-[45%] bg-[#0F172A] text-white p-12 flex-col justify-between">
        <div>
          <Link to="/" className="inline-flex items-center">
            <WeeberLogo size="md" inverted />
          </Link>
        </div>
        <div>
          <h1 className="text-3xl xl:text-4xl font-bold leading-[1.1] tracking-tight mb-6">
            One last step.
            <br />
            <span className="text-white/50">Check your inbox.</span>
          </h1>
          <div className="flex items-center gap-3 text-sm text-white/70">
            <Mail className="w-4 h-4 text-white/40 shrink-0" />
            We sent a 6-digit code to verify your email
          </div>
        </div>
        <div className="text-sm text-[#64748B]">
          Trusted by 340+ businesses. SOC 2 in progress.
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:py-0 bg-[#F8F9FB]">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center lg:hidden mb-8">
            <WeeberLogo size="md" />
          </Link>

          <h2 className="text-2xl font-semibold tracking-tight text-[#0F172A] mb-1">
            Verify your email
          </h2>
          <p className="text-sm text-[#475569] mb-8">
            Enter the 6-digit code we sent to{" "}
            <span className="font-medium text-[#0F172A]">{email}</span>
          </p>

          <div
            className={`flex justify-center gap-3 ${shake ? "animate-[shake_0.4s_ease-in-out]" : ""}`}
          >
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={CODE_LENGTH}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                disabled={verifying}
                className={`w-12 h-14 text-center text-xl font-semibold border rounded-md bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F172A] transition-all disabled:opacity-50 ${
                  error ? "border-red-400" : "border-[#E2E8F0]"
                }`}
              />
            ))}
          </div>

          {verifying && (
            <div className="flex items-center justify-center gap-2 mt-4 text-sm text-[#475569]">
              <Loader2 className="w-4 h-4 animate-spin" />
              Verifying...
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 text-center mt-4">{error}</p>
          )}

          <p className="text-sm text-[#64748B] text-center mt-6">
            Or open the link in the email — both work.
          </p>

          <div className="mt-8 flex flex-col items-center gap-4">
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className="text-sm font-medium text-[#0F172A] hover:underline disabled:text-[#94A3B8] disabled:no-underline transition-colors"
            >
              {resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : "Resend verification email"}
            </button>

            <Link
              to="/login"
              className="text-sm text-[#64748B] hover:text-[#475569] flex items-center gap-1"
            >
              Back to sign in
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
