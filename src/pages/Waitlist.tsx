import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { MarketingNav } from "../components/marketing/MarketingNav";
import { MarketingFooter } from "../components/marketing/MarketingFooter";
import { supabase } from "../lib/supabase";
import { TRACTION_STATS } from "../config/marketing";

export default function Waitlist() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setState("loading");
    setErrorMsg("");

    const { error } = await supabase.from("waitlist").insert({ email, source: "website" });

    if (error) {
      if (error.code === "23505") {
        setState("success");
      } else {
        setState("error");
        setErrorMsg("Something went wrong. Please try again.");
      }
    } else {
      setState("success");
    }
  }

  return (
    <div className="min-h-full bg-[#FAFAF8]">
      <MarketingNav />

      <section className="pt-32 pb-20 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="max-w-2xl">
            <div className="text-xs font-medium tracking-widest uppercase text-[#888] mb-4">
              Early access
            </div>
            <h1 className="text-4xl md:text-6xl font-bold leading-[0.95] tracking-tight text-[#111]">
              Get early access
              <br />
              <span className="text-[#888]">to Aurora Voice AI.</span>
            </h1>
            <p className="mt-6 text-lg text-[#555] leading-relaxed max-w-xl">
              We're onboarding businesses in batches. Join the waitlist to get notified
              when your spot opens. Early members get priority support and founder pricing.
            </p>

            {state === "success" ? (
              <div className="mt-10 bg-[#111] text-white p-8 rounded-none max-w-md">
                <div className="text-lg font-semibold">You're on the list.</div>
                <p className="mt-2 text-sm text-[#999] leading-relaxed">
                  We'll reach out when your spot opens. In the meantime, check out
                  our demo to see Aurora in action.
                </p>
                <Link
                  to="/demo"
                  className="mt-6 inline-flex items-center text-sm text-white font-medium hover:underline"
                >
                  Watch the demo
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-10 max-w-md">
                <div className="flex gap-3">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="flex-1 h-12 px-4 bg-white border border-[#D9D5CE] rounded-none text-sm text-[#111] placeholder:text-[#999] focus:outline-none focus:border-[#111] transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={state === "loading"}
                    className="h-12 px-6 bg-[#111] text-white text-sm font-medium rounded-none hover:bg-[#222] transition-colors disabled:opacity-50"
                  >
                    {state === "loading" ? "Joining..." : "Join waitlist"}
                  </button>
                </div>
                {state === "error" && (
                  <p className="mt-3 text-sm text-red-600">{errorMsg}</p>
                )}
                <p className="mt-3 text-xs text-[#888]">
                  No spam. We'll only email you when your spot opens.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      <section className="border-t border-[#D9D5CE] bg-[#F0EDE4]">
        <div className="max-w-[1200px] mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[#D9D5CE]">
            {TRACTION_STATS.map((stat) => (
              <div key={stat.label} className="px-6 first:pl-0 last:pr-0">
                <div className="font-mono text-2xl md:text-3xl font-bold text-[#111]">
                  {stat.value}
                </div>
                <div className="mt-1 text-xs text-[#888] tracking-wide uppercase">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#D9D5CE]">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-24">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="font-mono text-xs text-[#888] mb-3">01</div>
              <h3 className="font-semibold text-[#111]">Founder pricing</h3>
              <p className="mt-2 text-sm text-[#555] leading-relaxed">
                Early waitlist members lock in our lowest pricing tier permanently.
                No price increases, ever.
              </p>
            </div>
            <div>
              <div className="font-mono text-xs text-[#888] mb-3">02</div>
              <h3 className="font-semibold text-[#111]">Priority onboarding</h3>
              <p className="mt-2 text-sm text-[#555] leading-relaxed">
                Skip the queue. Get a 1-on-1 setup call with our team to configure
                your first agent in 15 minutes.
              </p>
            </div>
            <div>
              <div className="font-mono text-xs text-[#888] mb-3">03</div>
              <h3 className="font-semibold text-[#111]">Shape the product</h3>
              <p className="mt-2 text-sm text-[#555] leading-relaxed">
                Early users get a direct line to our product team. Your feedback
                drives what we build next.
              </p>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
