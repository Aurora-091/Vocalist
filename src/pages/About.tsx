import { ArrowRight } from "lucide-react";
import { MarketingNav } from "../components/marketing/MarketingNav";
import { MarketingFooter } from "../components/marketing/MarketingFooter";
import { TEAM, VALUES } from "../config/marketing";

export default function About() {
  return (
    <div className="marketing min-h-full">
      <MarketingNav />

      <section className="pt-32 pb-20 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-xs font-medium tracking-widest uppercase text-[#64748B] mb-4">
            About Weeber
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-[0.95] tracking-tight text-[#0F172A] max-w-3xl">
            We make voice AI
            <br />
            <span className="text-[#64748B]">accessible and compliant.</span>
          </h1>
          <p className="mt-6 text-lg text-[#475569] max-w-2xl leading-relaxed">
            Weeber was built for the businesses that enterprise AI vendors ignore — clinics,
            local shops, and Shopify merchants who need real calls handled without hiring
            a call center or violating consent regulations.
          </p>
        </div>
      </section>

      <section className="border-t border-[#E2E8F0]">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-24">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <div className="text-xs font-medium tracking-widest uppercase text-[#64748B] mb-4">
                Our mission
              </div>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#0F172A]">
                Every small business deserves a voice agent that respects the law.
              </h2>
            </div>
            <div className="space-y-4 text-[#475569] leading-relaxed">
              <p>
                The voice AI market was built for enterprises with legal teams and six-figure
                budgets. Compliance was an afterthought — bolted on after lawsuits, not designed
                in from day one.
              </p>
              <p>
                We started Weeber because we watched a Shopify merchant get a $12,000 TCPA fine
                for a cart-recovery campaign that a vendor told them was "compliant." It wasn't.
                The consent model was wrong, the opt-out mechanism was broken, and the audit trail
                didn't exist.
              </p>
              <p>
                Weeber enforces consent at the infrastructure level. You literally cannot dial a
                number that hasn't passed our consent gate. That's the product.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[#E2E8F0] bg-[#F1F5F9]">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-24">
          <div className="text-xs font-medium tracking-widest uppercase text-[#64748B] mb-4">
            Values
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#0F172A] mb-12">
            What we believe
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            {VALUES.map((value, i) => (
              <div key={value.title} className="flex gap-5">
                <span className="font-mono text-sm text-[#64748B] mt-0.5 shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="font-semibold text-[#0F172A]">{value.title}</h3>
                  <p className="mt-2 text-sm text-[#475569] leading-relaxed">{value.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#E2E8F0]">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-24">
          <div className="text-xs font-medium tracking-widest uppercase text-[#64748B] mb-4">
            Team
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#0F172A] mb-12">
            The people behind Weeber
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl">
            {TEAM.map((member) => (
              <div key={member.name}>
                <div className="aspect-[4/5] bg-[#E8ECF1] rounded-none mb-4" />
                <h3 className="font-semibold text-sm text-[#0F172A]">{member.name}</h3>
                <p className="text-xs text-[#64748B] mt-0.5">{member.role}</p>
                <p className="text-xs text-[#475569] mt-2 leading-relaxed">{member.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#111] text-white">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-24 text-center">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Get early access to Weeber
          </h2>
          <p className="mt-4 text-white/50 max-w-md mx-auto">
            We're onboarding in batches. Join the waitlist to reserve your spot and lock in founder pricing.
          </p>
          <a
            href="/#waitlist"
            className="mt-8 inline-flex items-center h-12 px-6 bg-white text-[#0F172A] text-sm font-medium rounded-none hover:bg-[#f0f0f0] transition-colors"
          >
            Join the waitlist
            <ArrowRight className="w-4 h-4 ml-2" />
          </a>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
