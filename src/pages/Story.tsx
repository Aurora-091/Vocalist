import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { MarketingNav } from "../components/marketing/MarketingNav";
import { MarketingFooter } from "../components/marketing/MarketingFooter";

const TIMELINE = [
  {
    year: "2023",
    title: "The $12,000 fine",
    body: "Our co-founder watched a Shopify merchant get fined for a cart-recovery campaign that a vendor said was compliant. It wasn't. The consent model was broken. We started building the infrastructure that would make this impossible.",
  },
  {
    year: "2023",
    title: "First prototype",
    body: "Built a consent-first dialer in a garage. One agent, one phone number, one very patient dentist's office. The agent booked 14 appointments in the first week.",
  },
  {
    year: "2024",
    title: "Seed round",
    body: "Raised $2.1M from operators who understood the TCPA compliance gap. Hired our first engineer and our Head of Compliance — a former FCC counsel.",
  },
  {
    year: "2024",
    title: "Public launch",
    body: "Opened the platform to Shopify merchants and healthcare clinics. 80 businesses signed up in the first month. Zero compliance violations.",
  },
  {
    year: "2025",
    title: "Series A",
    body: "Closed $8.5M to expand into new verticals: real estate, insurance, and home services. Built the multi-agent system and campaign orchestration layer.",
  },
  {
    year: "Today",
    title: "Scaling",
    body: "340+ active businesses. 2.4M calls handled. 99.7% uptime. Still zero TCPA violations. Now building the next generation of compliant voice intelligence.",
  },
] as const;

export default function Story() {
  return (
    <div className="marketing min-h-full">
      <MarketingNav />

      <section className="pt-32 pb-20 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-xs font-medium tracking-widest uppercase text-[#64748B] mb-4">
            Our story
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-[0.95] tracking-tight text-[#0F172A] max-w-3xl">
            Built from a compliance failure
            <br />
            <span className="text-[#64748B]">that should never have happened.</span>
          </h1>
        </div>
      </section>

      <section className="border-t border-[#E2E8F0] bg-[#F1F5F9]">
        <div className="max-w-[1200px] mx-auto px-6 py-16">
          <div className="max-w-3xl">
            <div className="border-l-2 border-[#111] pl-8">
              <p className="text-xl md:text-2xl text-[#0F172A] leading-relaxed font-medium">
                "We didn't start Aurora because we thought voice AI was cool. We started it
                because the existing tools were getting small businesses sued."
              </p>
              <p className="mt-4 text-sm text-[#64748B]">Marcus Chen, CEO</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[#E2E8F0]">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-24">
          <div className="space-y-0">
            {TIMELINE.map((entry, i) => (
              <div
                key={i}
                className="grid grid-cols-[80px_1fr] md:grid-cols-[120px_1fr] gap-6 py-8 border-b border-[#E2E8F0] last:border-b-0"
              >
                <div className="font-mono text-sm text-[#64748B] pt-1">{entry.year}</div>
                <div>
                  <h3 className="font-semibold text-[#0F172A] text-lg">{entry.title}</h3>
                  <p className="mt-2 text-[#475569] leading-relaxed max-w-2xl">{entry.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#111] text-white">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-24 text-center">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            The next chapter starts with you
          </h2>
          <p className="mt-4 text-white/50 max-w-md mx-auto">
            Join 340+ businesses using Aurora to handle real calls, compliantly.
          </p>
          <Link
            to="/signup"
            className="mt-8 inline-flex items-center h-12 px-6 bg-white text-[#0F172A] text-sm font-medium rounded-none hover:bg-[#f0f0f0] transition-colors"
          >
            Start free
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
