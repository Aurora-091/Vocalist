export const SITE = {
  name: "Aurora",
  tagline: "Voice AI for SMBs",
  description:
    "Aurora answers inbound calls, recovers abandoned carts, books appointments, and routes to humans — without breaking TCPA consent rules.",
};

export const NAV_LINKS = [
  { label: "About", href: "/about" },
  { label: "Story", href: "/story" },
  { label: "Demo", href: "/demo" },
  { label: "Funding", href: "/funding" },
] as const;

export const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Demo", href: "/demo" },
      { label: "Pricing", href: "/welcome#pricing" },
      { label: "Integrations", href: "/welcome#integrations" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Story", href: "/story" },
      { label: "Funding", href: "/funding" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
] as const;

export const TRACTION_STATS = [
  { value: "2.4M", label: "Calls handled" },
  { value: "340+", label: "Active businesses" },
  { value: "99.7%", label: "Uptime SLA" },
  { value: "<2s", label: "Avg. pickup time" },
] as const;

export const TEAM = [
  { name: "Marcus Chen", role: "CEO & Co-founder", bio: "Ex-Twilio. Built voice infra at scale." },
  { name: "Sarah Okafor", role: "CTO & Co-founder", bio: "ML engineer. Previously at Deepgram." },
  { name: "James Whitfield", role: "Head of Compliance", bio: "Former TCPA counsel at FCC." },
  { name: "Priya Sharma", role: "VP Engineering", bio: "Distributed systems. Ex-Stripe." },
] as const;

export const VALUES = [
  {
    title: "Compliance is not optional",
    body: "Every feature ships with consent checks. We never sacrifice regulatory safety for speed.",
  },
  {
    title: "Small business first",
    body: "We build for the clinic with 3 staff, the Shopify store with 200 orders/month. Enterprise comes later.",
  },
  {
    title: "Transparent by default",
    body: "Every call is transcribed. Every cost is itemized. Every decision is auditable.",
  },
  {
    title: "Humans in the loop",
    body: "AI handles volume. Humans handle nuance. We make the handoff seamless.",
  },
] as const;

export const INVESTORS_STATS = [
  { value: "$4.2M", label: "ARR" },
  { value: "18%", label: "MoM growth" },
  { value: "92%", label: "Gross margin" },
  { value: "< 3%", label: "Monthly churn" },
] as const;

export const CALL_TRANSCRIPT = [
  { speaker: "agent", text: "Good afternoon, this is Aurora calling on behalf of Bloom Dental. Am I speaking with Sarah?" },
  { speaker: "customer", text: "Yes, this is Sarah." },
  { speaker: "agent", text: "Hi Sarah. I'm reaching out because you have an upcoming cleaning appointment on Thursday at 2pm. I wanted to confirm you're still able to make it." },
  { speaker: "customer", text: "Oh right, Thursday. Actually, can I move it to Friday morning?" },
  { speaker: "agent", text: "Absolutely. I have openings at 9am and 10:30am on Friday. Which works better for you?" },
  { speaker: "customer", text: "9am is perfect." },
  { speaker: "agent", text: "Done. I've rescheduled you for Friday at 9am. You'll get a text confirmation in a moment. Is there anything else I can help with?" },
  { speaker: "customer", text: "No, that's it. Thank you." },
  { speaker: "agent", text: "You're welcome, Sarah. Have a great day." },
] as const;
