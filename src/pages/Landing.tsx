import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Phone, ShieldCheck, Zap, Bot, Megaphone, TrendingUp, ArrowRight, Menu, X, CircleCheck as CheckCircle, Star, Mail, MapPin, ChevronRight, Users, ChartBar as BarChart3, Globe, Sparkles } from "lucide-react";
import { WeeberLogo } from "../components/WeeberLogo";

const NAV_ITEMS = [
  { label: "Product", href: "#product" },
  { label: "Metrics", href: "#metrics" },
  { label: "Team", href: "#team" },
  { label: "Updates", href: "#news" },
  { label: "Investors", href: "/funding" },
  { label: "About", href: "/about" },
  { label: "Demo", href: "/demo" },
] as const;

const METRICS = [
  { value: "₹2Cr", label: "CEO's ARR", sub: "AdloomX business" },
  { value: "15+", label: "SMBs Queued", sub: "Pre-revenue pipeline" },
  { value: "34.8%", label: "Market CAGR", sub: "Voice AI through 2034" },
  { value: "₹20L", label: "Grant Target", sub: "DPIIT / TIDE 2.0" },
];

const FEATURES = [
  {
    icon: Bot,
    title: "Shopify Recovery Agent",
    body: "Outbound cart recovery + inbound order support. Native order lookup, cancellation, and discount-code application — directly in Shopify.",
    tag: "Ecommerce",
  },
  {
    icon: Phone,
    title: "Clinic Booking Agent",
    body: "Inbound booking, reminders, rescheduling, and no-show follow-up. BAA-ready and DPDP-compliant data handling.",
    tag: "Healthcare",
  },
  {
    icon: ShieldCheck,
    title: "Compliance Layer",
    body: "Consent ledger, opt-out propagation, inbound admission gates. TCPA + DPDP + GDPR shipped as product — not your problem.",
    tag: "Built-in",
  },
  {
    icon: Megaphone,
    title: "Outbound Campaigns",
    body: "Upload a CSV or sync from Shopify. The dialer handles concurrency, retries, voicemail detection, and live progress monitoring.",
    tag: "Campaigns",
  },
  {
    icon: BarChart3,
    title: "Analytics & Outcomes",
    body: "Every call logged with transcript, cost breakdown, and outcome classification. Watch recoveries and opt-out rates live.",
    tag: "Insights",
  },
  {
    icon: Globe,
    title: "India-First Pricing",
    body: "₹4,999/mo Starter, ₹12,999/mo Growth. DPDP-ready, ₹-denominated, designed for the Indian SMB market from day one.",
    tag: "Pricing",
  },
];

const STEPS = [
  { n: "01", title: "Trigger", body: "Cart abandoned, order placed, or appointment due. Native Shopify + clinic events fire your agent automatically." },
  { n: "02", title: "Call", body: "Weeber places or answers the call — human-parity voice, consent gate checked before every single dial." },
  { n: "03", title: "Action", body: "Applies discount, looks up order, books or reschedules — directly in the merchant system. No human needed." },
  { n: "04", title: "Outcome", body: "Recovered revenue logged, no-show prevented, consent and result written to the compliance ledger." },
];

const TEAM = [
  {
    initials: "AT",
    name: "Ashutosh Tiwari",
    role: "Founder & CEO",
    bio: "Founded AdloomX — Google Ad Grants & Helium10 partner at ~₹2 Cr ARR. Hands-on SMB GTM. Focused on automation, voice, and signal products.",
  },
  {
    initials: "RP",
    name: "Rushikesh Pawar",
    role: "Co-Founder & CTO",
    bio: "AI product engineer — React, Python, Supabase, LangChain, Groq. Built Weeber's working agent pipeline from scratch.",
  },
  {
    initials: "AS",
    name: "Amit Singh",
    role: "Advisor",
    bio: "Ex-Oracle Software Developer · SD Team Lead, Express Scripts. Strategic guidance on enterprise engineering.",
  },
];

const NEWS = [
  {
    tag: "Traction",
    date: "June 2026",
    title: "Kyonara.com joins as first Shopify design partner",
    body: "Indian D2C jewellery brand on Shopify — active pilot, recovering carts with Weeber's outbound voice agent.",
  },
  {
    tag: "Product",
    date: "June 2026",
    title: "15+ SMBs signed to waitlist before paid launch",
    body: "Organic demand queue forming before any paid acquisition. 20 structured pilots now planned for Q3 2026.",
  },
  {
    tag: "Compliance",
    date: "May 2026",
    title: "DPDP + TCPA compliance audit underway",
    body: "Weeber is preparing India's first DPDP-compliant outbound voice product, targeting full clearance by August 2026.",
  },
];

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function scrollTo(href: string) {
    if (href.startsWith("#")) {
      document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth" });
      setMobileOpen(false);
    }
  }

  return (
    <div className="marketing min-h-full bg-[#F8F9FB] overflow-x-hidden">
      {/* ── STICKY NAV ─────────────────────────────────────── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
          scrolled
            ? "bg-[#F8F9FB] border-b border-[#E4E7EE] shadow-[0_1px_12px_rgba(0,0,0,0.06)]"
            : "bg-[#F8F9FB]/90 backdrop-blur-sm"
        }`}
      >
        <div className="max-w-[1280px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex flex-col leading-none">
            <span className="font-black text-xl tracking-wider uppercase text-[#1d4ed8]" style={{ fontFamily: "'Geist Variable', sans-serif" }}>
              Weeber
            </span>
            <span className="text-[9px] font-semibold tracking-[0.18em] uppercase text-[#888]">
              Voice for Business
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {NAV_ITEMS.map((item) =>
              item.href.startsWith("#") ? (
                <button
                  key={item.label}
                  onClick={() => scrollTo(item.href)}
                  className="text-xs font-medium text-[#666] hover:text-[#0F172A] transition-colors tracking-wide"
                >
                  {item.label}
                </button>
              ) : (
                <Link
                  key={item.label}
                  to={item.href}
                  className="text-xs font-medium text-[#666] hover:text-[#0F172A] transition-colors tracking-wide"
                >
                  {item.label}
                </Link>
              )
            )}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" className="text-xs font-medium text-[#666] hover:text-[#0F172A] transition-colors">
              Sign in
            </Link>
            <Link
              to="/signup"
              className="inline-flex items-center h-9 px-5 bg-[#1d4ed8] text-white text-xs font-bold tracking-widest uppercase hover:opacity-90 transition-opacity"
            >
              Get Early Access
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-[#0F172A]"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden bg-[#F8F9FB] border-b border-[#E4E7EE] px-6 py-6 space-y-4">
            {NAV_ITEMS.map((item) =>
              item.href.startsWith("#") ? (
                <button
                  key={item.label}
                  onClick={() => scrollTo(item.href)}
                  className="block text-sm font-medium text-[#666] hover:text-[#0F172A]"
                >
                  {item.label}
                </button>
              ) : (
                <Link
                  key={item.label}
                  to={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="block text-sm font-medium text-[#666] hover:text-[#0F172A]"
                >
                  {item.label}
                </Link>
              )
            )}
            <div className="pt-2 border-t border-[#E4E7EE] flex flex-col gap-3">
              <Link to="/login" className="text-sm text-[#666]">Sign in</Link>
              <Link
                to="/signup"
                className="inline-flex items-center justify-center h-10 bg-[#1d4ed8] text-white text-xs font-bold uppercase tracking-widest"
              >
                Get Early Access
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── HERO ───────────────────────────────────────────── */}
      <section ref={heroRef} className="min-h-screen pt-14 flex items-center">
        <div className="max-w-[1280px] mx-auto px-6 py-24 w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 border border-[#1d4ed8] px-3 py-1.5 mb-8">
                <span className="w-1.5 h-1.5 bg-[#1d4ed8] rounded-full" />
                <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#1d4ed8]">
                  Grant Pitch · DPIIT · TIDE 2.0 · SIME IIM Bombay
                </span>
              </div>

              <h1
                className="text-[clamp(64px,10vw,120px)] font-black leading-[0.88] tracking-tight uppercase mb-6"
                style={{ fontFamily: "'Geist Variable', sans-serif" }}
              >
                <span className="text-[#0F172A]">Voice</span>
                <br />
                <span className="text-[#1d4ed8]">Workforce</span>
              </h1>

              <p className="text-lg text-[#555] max-w-xl leading-relaxed mb-10">
                The AI voice workforce every Indian SMB can finally afford. Vertical
                voice agents that recover revenue and cut no-shows — compliance built in.
              </p>

              <div className="grid grid-cols-3 gap-6 py-8 border-t border-b border-[#E4E7EE] mb-10">
                {METRICS.slice(0, 3).map((m) => (
                  <div key={m.label}>
                    <div
                      className="text-3xl font-black text-[#1d4ed8] leading-none mb-1"
                      style={{ fontFamily: "'Geist Variable', sans-serif" }}
                    >
                      {m.value}
                    </div>
                    <div className="text-[10px] font-bold tracking-[0.12em] uppercase text-[#888]">
                      {m.label}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <Link
                  to="/signup"
                  className="inline-flex items-center h-12 px-7 bg-[#1d4ed8] text-white text-sm font-bold tracking-widest uppercase hover:opacity-90 transition-opacity"
                >
                  Request Demo
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
                <button
                  onClick={() => scrollTo("#metrics")}
                  className="inline-flex items-center h-12 px-7 border-2 border-[#0F172A] text-[#0F172A] text-sm font-bold tracking-widest uppercase hover:bg-[#0F172A] hover:text-white transition-colors"
                >
                  View Investor Metrics
                </button>
              </div>
            </div>

            <div className="relative hidden lg:block">
              <div className="aspect-[4/5] overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=700&q=80"
                  alt="SMB owner using Weeber voice AI"
                  className="w-full h-full object-cover grayscale hover:grayscale-[60%] transition-all duration-500"
                />
              </div>
              <div className="absolute -bottom-5 -left-5 bg-[#1d4ed8] p-5 text-white">
                <div
                  className="text-3xl font-black leading-none"
                  style={{ fontFamily: "'Geist Variable', sans-serif" }}
                >
                  Live
                </div>
                <div className="text-[10px] font-bold tracking-widest uppercase mt-1">
                  Product in Production
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────── */}
      <section className="bg-[#0F172A] py-24">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1d4ed8] mb-4">
            How It Works
          </div>
          <h2
            className="text-[clamp(40px,6vw,72px)] font-black uppercase leading-[0.9] tracking-tight text-white mb-4"
            style={{ fontFamily: "'Geist Variable', sans-serif" }}
          >
            Four steps.
            <br />
            <span className="text-[#1d4ed8]">Zero setup.</span>
          </h2>
          <p className="text-[#666] text-base mb-14 max-w-lg">
            A real event triggers a real call — and ends in a recovered sale or a confirmed booking.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 border border-[#1E293B]">
            {STEPS.map((s, i) => (
              <div
                key={s.n}
                className={`p-8 border-[#1E293B] hover:bg-[#161B27] transition-colors ${
                  i < STEPS.length - 1 ? "border-b sm:border-b-0 sm:border-r" : ""
                }`}
              >
                <div
                  className={`text-4xl font-black leading-none mb-5 ${
                    i === STEPS.length - 1 ? "text-[#1d4ed8]" : "text-[#1d4ed8]"
                  }`}
                  style={{ fontFamily: "'Geist Variable', sans-serif" }}
                >
                  {s.n}
                </div>
                <div className="text-sm font-bold text-white uppercase tracking-widest mb-3">
                  {s.title}
                </div>
                <div className="text-sm text-[#777] leading-relaxed">{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRODUCT SHOWCASE ───────────────────────────────── */}
      <section id="product" className="py-24 bg-[#F8F9FB]">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1d4ed8] mb-4">
            Product
          </div>
          <div className="grid lg:grid-cols-2 gap-12 items-end mb-14">
            <h2
              className="text-[clamp(40px,5vw,64px)] font-black uppercase leading-[0.9] tracking-tight"
              style={{ fontFamily: "'Geist Variable', sans-serif" }}
            >
              <span className="text-[#0F172A]">The</span>
              <br />
              <span className="text-[#1d4ed8]">Solution</span>
            </h2>
            <p className="text-base text-[#555] leading-relaxed">
              Weeber is a vertical, compliance-aware voice agent platform that places and answers
              phone calls — recovering lost revenue and reducing operational leakage for Indian SMBs.
              No setup. No configuration. Outcomes in Week 1.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 border-2 border-[#0F172A]">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              const isLast = i === FEATURES.length - 1;
              return (
                <div
                  key={f.title}
                  className={`p-8 hover:bg-[#F1F3F7] transition-colors border-[#0F172A] ${
                    i % 3 !== 2 ? "lg:border-r-2" : ""
                  } ${i < FEATURES.length - 3 ? "border-b-2" : ""} ${
                    i < FEATURES.length - (FEATURES.length % 2 === 0 ? 2 : 1) ? "sm:border-b-2 lg:border-b-0" : ""
                  }`}
                >
                  <div className="w-10 h-10 bg-[#1d4ed8] flex items-center justify-center mb-5">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="inline-block text-[9px] font-bold tracking-[0.14em] uppercase bg-[#0F172A] text-white px-2 py-0.5 mb-3">
                    {f.tag}
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-wide mb-3">{f.title}</h3>
                  <p className="text-sm text-[#555] leading-relaxed">{f.body}</p>
                </div>
              );
            })}
          </div>

          {/* Value strip */}
          <div className="grid grid-cols-3 bg-[#0F172A] border-2 border-[#0F172A] border-t-0">
            {["Recovered revenue", "Fewer no-shows", "Compliance as moat"].map((v, i) => (
              <div
                key={v}
                className={`px-8 py-4 flex items-center gap-3 ${i < 2 ? "border-r border-[#1E293B]" : ""}`}
              >
                <span className="text-[#1d4ed8] font-bold">✓</span>
                <span className="text-xs font-bold tracking-widest uppercase text-white">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINANCIAL METRICS / INVESTOR HIGHLIGHTS ────────── */}
      <section id="metrics" className="py-24 bg-[#0F172A]">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1d4ed8] mb-4">
            Investor Highlights
          </div>
          <div className="grid lg:grid-cols-2 gap-16 items-start mb-16">
            <h2
              className="text-[clamp(40px,5vw,64px)] font-black uppercase leading-[0.9] tracking-tight text-white"
              style={{ fontFamily: "'Geist Variable', sans-serif" }}
            >
              Market
              <br />
              <span className="text-[#1d4ed8]">Opportunity</span>
            </h2>
            <p className="text-[#888] text-base leading-relaxed pt-2">
              Voice AI is the fastest-growing enterprise software category. India's 80M+ SMBs
              represent the biggest underserved market — with no compliant, vertical-native
              solution until Weeber.
            </p>
          </div>

          {/* Key metrics */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-0 border border-[#1E293B] mb-8">
            {METRICS.map((m, i) => (
              <div
                key={m.label}
                className={`p-8 border-[#1E293B] ${i < METRICS.length - 1 ? "border-b lg:border-b-0 lg:border-r" : ""}`}
              >
                <div
                  className="text-4xl font-black text-[#1d4ed8] leading-none mb-2"
                  style={{ fontFamily: "'Geist Variable', sans-serif" }}
                >
                  {m.value}
                </div>
                <div className="text-xs font-bold text-white tracking-wide mb-1">{m.label}</div>
                <div className="text-xs text-[#666]">{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Market size */}
          <div className="grid lg:grid-cols-3 gap-0 border border-[#1E293B]">
            {[
              { v: "$47.5B", title: "Voice AI market by 2034", body: "34.8% CAGR — vertical agents are the breakout category" },
              { v: "₹2.2L Cr", title: "Lost to cart abandonment", body: "70.2% avg abandonment. A ₹1Cr store leaks ~₹4.8L/year" },
              { v: "₹1.3L Cr", title: "Missed appointment losses", body: "5–30% no-show rates across India's 4.38L health facilities" },
            ].map((stat, i) => (
              <div key={stat.title} className={`p-8 ${i < 2 ? "border-b lg:border-b-0 lg:border-r border-[#1E293B]" : ""}`}>
                <div
                  className="text-3xl font-black text-[#1d4ed8] leading-none mb-3"
                  style={{ fontFamily: "'Geist Variable', sans-serif" }}
                >
                  {stat.v}
                </div>
                <div className="text-sm font-bold text-white mb-2">{stat.title}</div>
                <div className="text-xs text-[#666] leading-relaxed">{stat.body}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <p className="text-xs text-[#555] max-w-lg">
              Unit economics: 10% recovery on ₹750 avg cart → ~₹43,000/mo recovered for a ₹50L/yr Shopify store.
              Growth plan ROI = <strong className="text-[#1d4ed8]">3.3× in Month 1.</strong>
            </p>
            <Link
              to="/funding"
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#1d4ed8] border border-[#1d4ed8] px-4 py-2 hover:bg-[#1d4ed8] hover:text-white transition-colors whitespace-nowrap"
            >
              Full Investor Deck
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── TEAM ───────────────────────────────────────────── */}
      <section id="team" className="py-24 bg-[#F8F9FB]">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1d4ed8] mb-4">
            Team
          </div>
          <h2
            className="text-[clamp(40px,5vw,64px)] font-black uppercase leading-[0.9] tracking-tight mb-16"
            style={{ fontFamily: "'Geist Variable', sans-serif" }}
          >
            <span className="text-[#0F172A]">The People</span>
            <br />
            <span className="text-[#1d4ed8]">Behind Weeber</span>
          </h2>

          <div className="grid md:grid-cols-3 gap-0 border-2 border-[#0F172A]">
            {TEAM.map((member, i) => (
              <div
                key={member.name}
                className={`p-8 hover:bg-[#F1F3F7] transition-colors ${
                  i < TEAM.length - 1 ? "border-b-2 md:border-b-0 md:border-r-2 border-[#0F172A]" : ""
                }`}
              >
                <div className="flex items-center gap-4 mb-5">
                  <div
                    className="w-12 h-12 bg-[#0F172A] flex items-center justify-center text-[#1d4ed8] font-black text-base tracking-wider shrink-0"
                    style={{ fontFamily: "'Geist Variable', sans-serif" }}
                  >
                    {member.initials}
                  </div>
                  <div>
                    <div className="font-bold text-sm">{member.name}</div>
                    <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-[#1d4ed8]">
                      {member.role}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-[#555] leading-relaxed">{member.bio}</p>
              </div>
            ))}
          </div>

          <div className="mt-0 bg-[#0F172A] p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-2 border-[#0F172A] border-t-0">
            <div>
              <div className="text-xs font-bold text-white mb-1">Traction so far</div>
              <div className="text-xs text-[#666]">
                Live product · Kyonara.com pilot · 15+ SMBs in queue · 20 structured pilots planned
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {["DPIIT", "TIDE 2.0", "SIME IIM Bombay"].map((g) => (
                <span
                  key={g}
                  className="text-[10px] font-bold tracking-widest uppercase border border-[#1d4ed8] text-[#1d4ed8] px-2.5 py-1"
                >
                  {g}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── NEWS / UPDATES ─────────────────────────────────── */}
      <section id="news" className="py-24 bg-white border-t border-[#E2DED8]">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1d4ed8] mb-4">
            Latest Updates
          </div>
          <div className="flex items-end justify-between mb-14 flex-wrap gap-4">
            <h2
              className="text-[clamp(36px,4vw,56px)] font-black uppercase leading-[0.9] tracking-tight"
              style={{ fontFamily: "'Geist Variable', sans-serif" }}
            >
              <span className="text-[#0F172A]">What's</span>
              <br />
              <span className="text-[#1d4ed8]">Happening</span>
            </h2>
            <Link to="/demo" className="text-xs font-bold uppercase tracking-widest text-[#555] hover:text-[#0F172A] flex items-center gap-1">
              See the demo <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-0 border-2 border-[#0F172A]">
            {NEWS.map((item, i) => (
              <div
                key={item.title}
                className={`p-8 hover:bg-[#F1F3F7] transition-colors ${
                  i < NEWS.length - 1 ? "border-b-2 md:border-b-0 md:border-r-2 border-[#0F172A]" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-5">
                  <span className="text-[9px] font-bold tracking-[0.14em] uppercase bg-[#1d4ed8] text-white px-2.5 py-1">
                    {item.tag}
                  </span>
                  <span className="text-xs text-[#888]">{item.date}</span>
                </div>
                <h3 className="font-bold text-sm mb-3 leading-snug">{item.title}</h3>
                <p className="text-sm text-[#555] leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT ────────────────────────────────────────── */}
      <section id="contact" className="py-24 bg-[#0F172A]">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1d4ed8] mb-4">
                Contact
              </div>
              <h2
                className="text-[clamp(40px,5vw,64px)] font-black uppercase leading-[0.9] tracking-tight text-white mb-6"
                style={{ fontFamily: "'Geist Variable', sans-serif" }}
              >
                The Future
                <br />
                Is
                <br />
                <span className="text-[#1d4ed8]">Spoken.</span>
              </h2>
              <p className="text-[#888] text-base leading-relaxed mb-10 max-w-md">
                Weeber gives every Indian SMB a voice workforce that recovers revenue, reduces
                no-shows, and treats compliance as product. One vertical at a time.
              </p>

              <div className="space-y-4 mb-10">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#1d4ed8] flex items-center justify-center shrink-0">
                    <Mail className="w-3.5 h-3.5 text-white" />
                  </div>
                  <a href="mailto:ashutosh@weeber.ai" className="text-sm text-[#1d4ed8] hover:underline">
                    ashutosh@weeber.ai
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#161B27] border border-[#1E293B] flex items-center justify-center shrink-0">
                    <Globe className="w-3.5 h-3.5 text-[#888]" />
                  </div>
                  <span className="text-sm text-[#666]">weeber.ai</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#161B27] border border-[#1E293B] flex items-center justify-center shrink-0">
                    <MapPin className="w-3.5 h-3.5 text-[#888]" />
                  </div>
                  <span className="text-sm text-[#666]">India</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href="mailto:ashutosh@weeber.ai"
                  className="inline-flex items-center h-12 px-7 bg-[#1d4ed8] text-white text-sm font-bold tracking-widest uppercase hover:opacity-90 transition-opacity"
                >
                  Request Demo
                </a>
                <a
                  href="mailto:ashutosh@weeber.ai?subject=Grant%20Conversation%20—%20Weeber"
                  className="inline-flex items-center h-12 px-7 border-2 border-white text-white text-sm font-bold tracking-widest uppercase hover:bg-white hover:text-[#0F172A] transition-colors"
                >
                  Discuss Grant
                </a>
              </div>
            </div>

            {/* Mini contact form */}
            <div className="bg-[#161B27] border border-[#1E293B] p-8">
              <div className="text-xs font-bold tracking-widest uppercase text-[#888] mb-6">
                Send a message
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  window.location.href = "mailto:ashutosh@weeber.ai";
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-[10px] font-bold tracking-widest uppercase text-[#666] mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full h-11 px-4 bg-[#0F172A] border border-[#1E293B] text-white text-sm placeholder:text-[#444] focus:outline-none focus:border-[#1d4ed8] transition-colors"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold tracking-widest uppercase text-[#666] mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    className="w-full h-11 px-4 bg-[#0F172A] border border-[#1E293B] text-white text-sm placeholder:text-[#444] focus:outline-none focus:border-[#1d4ed8] transition-colors"
                    placeholder="you@company.com"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold tracking-widest uppercase text-[#666] mb-2">
                    I'm a
                  </label>
                  <select className="w-full h-11 px-4 bg-[#0F172A] border border-[#1E293B] text-white text-sm focus:outline-none focus:border-[#1d4ed8] transition-colors">
                    <option value="smb">SMB owner</option>
                    <option value="investor">Investor / Grant body</option>
                    <option value="partner">Integration partner</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold tracking-widest uppercase text-[#666] mb-2">
                    Message
                  </label>
                  <textarea
                    rows={3}
                    className="w-full px-4 py-3 bg-[#0F172A] border border-[#1E293B] text-white text-sm placeholder:text-[#444] focus:outline-none focus:border-[#1d4ed8] transition-colors resize-none"
                    placeholder="What would you like to discuss?"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full h-11 bg-[#1d4ed8] text-white text-xs font-bold tracking-widest uppercase hover:opacity-90 transition-opacity"
                >
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <footer className="bg-[#07090E] border-t border-[#161B27]">
        <div className="max-w-[1280px] mx-auto px-6 py-12">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-1">
              <div className="font-black text-xl tracking-wider uppercase text-[#1d4ed8] mb-1" style={{ fontFamily: "'Geist Variable', sans-serif" }}>
                Weeber
              </div>
              <div className="text-[9px] font-semibold tracking-[0.18em] uppercase text-[#555] mb-4">
                Voice for Business
              </div>
              <p className="text-xs text-[#555] leading-relaxed">
                AI voice workforce for Indian SMBs. Compliance built in.
              </p>
            </div>

            <div>
              <div className="text-[10px] font-bold tracking-widest uppercase text-[#444] mb-4">Product</div>
              <div className="space-y-3">
                {[
                  { label: "Demo", to: "/demo" },
                  { label: "About", to: "/about" },
                  { label: "Story", to: "/story" },
                  { label: "Waitlist", to: "/waitlist" },
                ].map((l) => (
                  <Link key={l.label} to={l.to} className="block text-xs text-[#666] hover:text-[#1d4ed8] transition-colors">
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold tracking-widest uppercase text-[#444] mb-4">Investors</div>
              <div className="space-y-3">
                {[
                  { label: "Funding", to: "/funding" },
                  { label: "Sign in", to: "/login" },
                  { label: "Sign up", to: "/signup" },
                ].map((l) => (
                  <Link key={l.label} to={l.to} className="block text-xs text-[#666] hover:text-[#1d4ed8] transition-colors">
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold tracking-widest uppercase text-[#444] mb-4">Legal</div>
              <div className="space-y-3">
                {[
                  { label: "Privacy Policy", to: "/privacy" },
                  { label: "Terms", to: "/terms" },
                ].map((l) => (
                  <Link key={l.label} to={l.to} className="block text-xs text-[#666] hover:text-[#1d4ed8] transition-colors">
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-[#161B27] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="text-xs text-[#444]">
              © 2026 Weeber Voice AI. June 2026 · Pre-revenue · Confidential.
            </div>
            <div className="flex items-center gap-4">
              <a href="mailto:ashutosh@weeber.ai" className="text-xs text-[#1d4ed8] hover:underline">
                ashutosh@weeber.ai
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
