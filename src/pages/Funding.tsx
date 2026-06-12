import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { MarketingNav } from "../components/marketing/MarketingNav";
import { MarketingFooter } from "../components/marketing/MarketingFooter";
import { INVESTORS_STATS } from "../config/marketing";

export default function Funding() {
  return (
    <div className="marketing min-h-full bg-[#F8F9FB]">
      <MarketingNav />

      <section className="pt-32 pb-20 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-xs font-medium tracking-widest uppercase text-[#888] mb-4">
            For investors
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-[0.95] tracking-tight text-[#111] max-w-3xl">
            The compliance layer
            <br />
            <span className="text-[#888]">for voice AI.</span>
          </h1>
          <p className="mt-6 text-lg text-[#555] max-w-2xl leading-relaxed">
            Weeber is building the infrastructure that makes outbound voice AI legally safe.
            We're the consent and compliance engine that every voice agent needs — whether
            it's ours or someone else's.
          </p>
        </div>
      </section>

      <section className="border-t border-[#D9D5CE] bg-[#F0EDE4]">
        <div className="max-w-[1200px] mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[#D9D5CE]">
            {INVESTORS_STATS.map((stat) => (
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
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <div className="text-xs font-medium tracking-widest uppercase text-[#888] mb-4">
                Why now
              </div>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#111]">
                Voice AI is exploding. Compliance isn't keeping up.
              </h2>
            </div>
            <div className="space-y-4 text-[#555] leading-relaxed">
              <p>
                The voice AI market will reach $50B by 2028. But TCPA lawsuits grew 34% last
                year alone. Every AI-powered outbound call is a potential violation if consent
                isn't handled correctly.
              </p>
              <p>
                Most voice AI platforms treat compliance as a feature checkbox. We treat it
                as infrastructure. Our consent gate is append-only, audit-ready, and blocks
                non-compliant dials at the infrastructure level — not the application level.
              </p>
              <p>
                This positions Weeber as both a standalone product (for SMBs who want a full
                voice agent) and a compliance platform (for enterprises who want to make their
                existing voice AI legally safe).
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[#D9D5CE] bg-[#F0EDE4]">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-24">
          <div className="text-xs font-medium tracking-widest uppercase text-[#888] mb-4">
            What we're building next
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#111] mb-12">
            The roadmap
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-[#FAFAF8] border border-[#D9D5CE] p-6 rounded-none">
              <div className="font-mono text-xs text-[#888] mb-3">Q3 2026</div>
              <h3 className="font-semibold text-[#111]">Compliance API</h3>
              <p className="mt-2 text-sm text-[#555] leading-relaxed">
                Let any voice platform plug into our consent engine via API. Pay per-check
                pricing. Zero TCPA liability for the customer.
              </p>
            </div>
            <div className="bg-[#FAFAF8] border border-[#D9D5CE] p-6 rounded-none">
              <div className="font-mono text-xs text-[#888] mb-3">Q4 2026</div>
              <h3 className="font-semibold text-[#111]">Multi-state DNC</h3>
              <p className="mt-2 text-sm text-[#555] leading-relaxed">
                Automatic integration with state-level Do Not Call registries. Real-time
                scrubbing. Currently only federal DNC is covered by competitors.
              </p>
            </div>
            <div className="bg-[#FAFAF8] border border-[#D9D5CE] p-6 rounded-none">
              <div className="font-mono text-xs text-[#888] mb-3">2027</div>
              <h3 className="font-semibold text-[#111]">Enterprise tier</h3>
              <p className="mt-2 text-sm text-[#555] leading-relaxed">
                SOC 2 Type II, custom deployment, dedicated compliance officer, SLA-backed
                uptime. For companies with 10K+ outbound calls/month.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[#D9D5CE]">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-24">
          <div className="max-w-2xl">
            <div className="text-xs font-medium tracking-widest uppercase text-[#888] mb-4">
              Get in touch
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#111]">
              Interested in Weeber?
            </h2>
            <p className="mt-4 text-[#555] leading-relaxed">
              We're always open to conversations with investors who understand infrastructure
              and compliance. Reach out to discuss our vision, metrics, or partnership
              opportunities.
            </p>
            <div className="mt-8 space-y-3 text-sm text-[#555]">
              <div className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 bg-[#111] rounded-none shrink-0" />
                Deck available on request
              </div>
              <div className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 bg-[#111] rounded-none shrink-0" />
                Data room with full financials
              </div>
              <div className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 bg-[#111] rounded-none shrink-0" />
                Customer references available
              </div>
            </div>
            <Link
              to="/signup"
              className="mt-8 inline-flex items-center h-12 px-6 bg-[#111] text-white text-sm font-medium rounded-none hover:bg-[#222] transition-colors"
            >
              Contact us
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
