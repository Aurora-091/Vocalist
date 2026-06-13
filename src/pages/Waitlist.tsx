import { useState } from "react";
import { ArrowRight, Phone, ShieldCheck, ChartBar as BarChart3, CircleCheck as CheckCircle2, Circle as XCircle, Mail } from "lucide-react";
import { MarketingNav } from "../components/marketing/MarketingNav";
import { MarketingFooter } from "../components/marketing/MarketingFooter";
import { joinWaitlist } from "../lib/api";
import { useWaitlistCount } from "../lib/useWaitlistCount";
import { trackFormSubmit, trackFormSuccess } from "../lib/analytics";
import { USE_CASES, HOW_IT_WORKS } from "../config/marketing";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";

const USE_CASE_ICONS = [ShieldCheck, BarChart3, Phone];
const BASE_COUNT = 170;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone: string) {
  if (!phone) return true;
  return /^\+?[\d\s\-()]{7,20}$/.test(phone);
}

function HeroForm() {
  const { count } = useWaitlistCount();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState({ name: false, email: false, phone: false });
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const emailValid = isValidEmail(email);
  const phoneValid = isValidPhone(phone);
  const nameValid = name.trim().length > 0;
  const canSubmit = nameValid && emailValid && phoneValid;
  const displayCount = count !== null ? count + BASE_COUNT : BASE_COUNT;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setState("loading");
    setErrorMsg("");
    trackFormSubmit();

    const payload: { name: string; email: string; phone?: string } = {
      name: name.trim(),
      email: email.trim(),
    };
    if (phone.trim()) payload.phone = phone.trim();

    const result = await joinWaitlist(payload);
    if (result.success) {
      setState("success");
      setShowSuccess(true);
      trackFormSuccess();
    } else {
      setState("error");
      setErrorMsg(result.error || "Something went wrong. Try again or email hello@weeber.ai");
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Name */}
        <div className="relative">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => { setName(e.target.value); setTouched((t) => ({ ...t, name: true })); }}
            placeholder="Your name"
            className="w-full h-12 px-4 pr-10 text-sm bg-white border border-[#E2E8F0] text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0F172A] focus:outline-none transition-colors"
          />
          {touched.name && name.length >= 1 && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {nameValid ? (
                <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
            </span>
          )}
        </div>

        {/* Email */}
        <div className="relative">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => { setEmail(e.target.value); setTouched((t) => ({ ...t, email: true })); }}
            placeholder="you@company.com"
            className="w-full h-12 px-4 pr-10 text-sm bg-white border border-[#E2E8F0] text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0F172A] focus:outline-none transition-colors"
          />
          {touched.email && email.length >= 3 && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {emailValid ? (
                <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
            </span>
          )}
        </div>

        {/* Phone (optional) */}
        <div className="relative">
          <input
            type="tel"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setTouched((t) => ({ ...t, phone: true })); }}
            placeholder="+91 98765 43210 (optional)"
            className="w-full h-12 px-4 pr-10 text-sm bg-white border border-[#E2E8F0] text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0F172A] focus:outline-none transition-colors"
          />
          {touched.phone && phone.length >= 7 && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {phoneValid ? (
                <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
            </span>
          )}
        </div>

        <button
          type="submit"
          disabled={state === "loading" || !canSubmit}
          className="w-full h-12 text-sm font-medium bg-[#0F172A] text-white hover:bg-[#1E293B] transition-colors disabled:opacity-50"
        >
          {state === "loading" ? "Joining..." : "Get early access"}
        </button>

        {state === "error" && (
          <p className="text-xs text-red-600">{errorMsg}</p>
        )}

        <p className="text-xs text-[#94A3B8] text-center">
          No credit card. No code. First 100 businesses get founder pricing.
        </p>
      </form>

      {/* Live counter */}
      <div className="mt-5 flex items-center justify-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
        <span className="text-sm font-medium text-[#0F172A]">
          {displayCount}+ businesses on the waitlist
        </span>
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="sm:max-w-[420px] p-6 bg-[#FAFAFA] text-[#0F172A] ring-[#E2E8F0] [&_button[data-slot=dialog-close]]:text-[#64748B] [&_button[data-slot=dialog-close]]:hover:text-[#0F172A] [&_button[data-slot=dialog-close]]:hover:bg-[#F1F5F9]">
          <DialogHeader className="items-center text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-[#22C55E] flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <DialogTitle className="text-xl font-bold text-[#0F172A]">
              We've added you to our waitlist!
            </DialogTitle>
            <DialogDescription className="text-[#64748B] mt-1">
              We'll let you know when Weeber is ready for you.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex items-center gap-3 px-4 py-3 bg-[#F1F5F9] border border-[#E2E8F0] rounded-md">
            <Mail className="w-4 h-4 text-[#64748B] flex-shrink-0" />
            <span className="text-sm text-[#0F172A] truncate">{email}</span>
          </div>

          <p className="mt-4 text-xs text-[#94A3B8] text-center">
            Weeber is coming soon. Built compliance-first to give you back your time.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Waitlist() {
  return (
    <div className="marketing min-h-full bg-[#F8F9FB]">
      <MarketingNav />

      {/* Hero with form */}
      <section id="waitlist" className="pt-32 pb-20 md:pb-24 px-6">
        <div className="max-w-[640px] mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold leading-[0.95] tracking-tight text-[#0F172A]">
            Your business
            <br />
            never misses
            <br />
            <span className="text-[#64748B]">a call again.</span>
          </h1>
          <p className="mt-6 text-lg text-[#475569] leading-relaxed max-w-lg mx-auto">
            The only voice agent built with compliance first. TCPA-verified. Works in minutes.
          </p>
          <div className="mt-8">
            <HeroForm />
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="border-t border-[#E2E8F0] bg-[#F8F9FB]">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-24">
          <div className="text-xs font-medium tracking-widest uppercase text-[#64748B] mb-4">
            What Weeber does
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#0F172A] mb-0 max-w-xl">
            Three problems. One voice agent.
          </h2>
          <div>
            {USE_CASES.map((uc, i) => {
              const Icon = USE_CASE_ICONS[i];
              const isEven = i % 2 === 0;
              return (
                <div
                  key={uc.vertical}
                  className={`grid md:grid-cols-2 gap-12 items-center py-16 border-t border-[#E2E8F0] mt-12 first:mt-12 ${
                    !isEven ? "md:[&>*:first-child]:order-last" : ""
                  }`}
                >
                  <div>
                    <div className="text-xs font-medium tracking-widest uppercase text-[#64748B] mb-3">
                      {uc.vertical}
                    </div>
                    <h3 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#0F172A] mb-4">
                      {uc.headline}
                    </h3>
                    <p className="text-[#475569] leading-relaxed">{uc.body}</p>
                    <div className="mt-6 inline-flex items-center gap-3 bg-[#F0EDE4] border border-[#D9D5CE] px-4 py-2.5">
                      <ArrowRight className="w-3.5 h-3.5 text-[#64748B] flex-shrink-0" />
                      <span className="text-sm text-[#475569]">{uc.stat}</span>
                    </div>
                  </div>
                  <div className="bg-white border border-[#E2E8F0] p-8 aspect-[4/3] flex flex-col justify-between">
                    <div className="w-10 h-10 bg-[#F1F5F9] flex items-center justify-center">
                      <Icon className="w-5 h-5 text-[#0F172A]" />
                    </div>
                    <div>
                      <div className="font-mono text-3xl font-bold text-[#0F172A] mb-1">
                        {["18\u201324%", "3.2 hrs", "24/7"][i]}
                      </div>
                      <div className="text-xs text-[#64748B] uppercase tracking-wide">
                        {["cart recovery rate", "saved per day", "calls answered"][i]}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-[#E2E8F0] bg-[#F0EDE4]">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-24">
          <div className="text-xs font-medium tracking-widest uppercase text-[#64748B] mb-4">
            How it works
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#0F172A] mb-12 max-w-xl">
            Built compliance-first, not bolted on.
          </h2>
          <div className="grid md:grid-cols-3 gap-0 border border-[#D9D5CE]">
            {HOW_IT_WORKS.map((step, i) => (
              <div
                key={step.step}
                className={`p-8 bg-white ${i < HOW_IT_WORKS.length - 1 ? "border-b md:border-b-0 md:border-r border-[#D9D5CE]" : ""}`}
              >
                <div className="font-mono text-xs text-[#64748B] mb-5">{step.step}</div>
                <h3 className="font-semibold text-[#0F172A] mb-3">{step.title}</h3>
                <p className="text-sm text-[#475569] leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why compliance matters */}
      <section className="border-t border-[#E2E8F0] bg-[#F8F9FB]">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-24">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <div className="text-xs font-medium tracking-widest uppercase text-[#64748B] mb-4">
                Why we exist
              </div>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#0F172A]">
                Enterprise AI was built for enterprises.
                <span className="text-[#64748B]"> We built ours for everyone else.</span>
              </h2>
            </div>
            <div className="space-y-4 text-[#475569] leading-relaxed">
              <p>
                The voice AI market was designed for companies with legal teams and
                six-figure budgets. Compliance was an afterthought — added after lawsuits,
                not designed in from day one.
              </p>
              <p>
                We watched a Shopify merchant receive a $12,000 TCPA fine for a
                cart-recovery campaign their vendor told them was "compliant." The consent
                model was wrong. The opt-out mechanism was broken. The audit trail
                didn't exist.
              </p>
              <p>
                Weeber enforces consent at the infrastructure level. You literally cannot
                dial a number that hasn't passed our consent gate. That's the product.
              </p>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
