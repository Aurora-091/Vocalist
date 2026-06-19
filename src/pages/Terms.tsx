import { useState, useEffect, useRef } from "react";
import { MarketingNav } from "../components/marketing/MarketingNav";
import { MarketingFooter } from "../components/marketing/MarketingFooter";

const SECTIONS = [
  { id: "acceptance", title: "Acceptance of Terms" },
  { id: "description", title: "Description of Service" },
  { id: "accounts", title: "Accounts & Registration" },
  { id: "acceptable-use", title: "Acceptable Use" },
  { id: "compliance-obligations", title: "Compliance Obligations" },
  { id: "call-recording", title: "Call Recording" },
  { id: "billing", title: "Billing & Payment" },
  { id: "intellectual-property", title: "Intellectual Property" },
  { id: "limitation-of-liability", title: "Limitation of Liability" },
  { id: "termination", title: "Termination" },
  { id: "governing-law", title: "Governing Law" },
] as const;

function useTocActive(sectionIds: readonly string[]) {
  const [activeId, setActiveId] = useState(sectionIds[0]);
  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observer.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0% -70% 0%" }
    );

    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) observer.current.observe(el);
    }

    return () => observer.current?.disconnect();
  }, [sectionIds]);

  return activeId;
}

export default function Terms() {
  const activeId = useTocActive(SECTIONS.map((s) => s.id));

  return (
    <div className="marketing min-h-full bg-[#F8F9FB]">
      <MarketingNav />

      <main id="main-content">
      <div className="pt-32 pb-20 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-xs font-medium tracking-widest uppercase text-[#888] mb-4">
            Legal
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#111]">
            Terms of Service
          </h1>
          <p className="mt-4 text-sm text-[#888]">Last updated: June 1, 2026</p>
        </div>
      </div>

      <div className="border-t border-[#D9D5CE]">
        <div className="max-w-[1200px] mx-auto px-6 py-16">
          <div className="grid md:grid-cols-[220px_1fr] gap-12">
            <nav aria-label="Table of contents" className="hidden md:block sticky top-24 self-start">
              <ul className="space-y-2">
                {SECTIONS.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className={`block text-xs py-1 transition-colors ${
                        activeId === section.id
                          ? "text-[#111] font-medium"
                          : "text-[#888] hover:text-[#555]"
                      }`}
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="legal-prose">
              <section id="acceptance" className="mb-12">
                <h2>Acceptance of Terms</h2>
                <p>
                  By accessing or using Weeber Voice AI ("the Service"), you agree to be bound
                  by these Terms of Service ("Terms"). If you are using the Service on behalf
                  of an organization, you represent that you have authority to bind that
                  organization to these Terms.
                </p>
                <p>
                  If you do not agree to these Terms, you may not access or use the Service.
                  We reserve the right to modify these Terms at any time, with notice provided
                  via email or through the Service interface.
                </p>
              </section>

              <section id="description" className="mb-12">
                <h2>Description of Service</h2>
                <p>
                  Weeber provides an AI-powered voice calling platform that enables businesses
                  to automate inbound and outbound phone calls. The Service includes voice
                  agents, campaign management, consent enforcement, call recording and
                  transcription, and related analytics.
                </p>
                <p>
                  The Service is designed to facilitate compliant voice communications. However,
                  ultimate responsibility for regulatory compliance lies with the customer.
                  Weeber provides tools and infrastructure to support compliance but does not
                  provide legal advice.
                </p>
              </section>

              <section id="accounts" className="mb-12">
                <h2>Accounts & Registration</h2>
                <p>
                  To use the Service, you must create an account with accurate and complete
                  information. You are responsible for maintaining the security of your
                  account credentials and for all activities that occur under your account.
                </p>
                <p>
                  You must notify us immediately of any unauthorized access to your account.
                  We reserve the right to suspend accounts that we reasonably believe have
                  been compromised.
                </p>
              </section>

              <section id="acceptable-use" className="mb-12">
                <h2>Acceptable Use</h2>
                <p>You agree not to use the Service to:</p>
                <ul>
                  <li>Make calls without proper consent as required by TCPA and applicable state laws</li>
                  <li>Engage in fraudulent, deceptive, or misleading communications</li>
                  <li>Harass, threaten, or abuse any person</li>
                  <li>Violate any applicable law, regulation, or industry standard</li>
                  <li>Attempt to circumvent our consent enforcement mechanisms</li>
                  <li>Use the Service for debt collection without proper licensing</li>
                  <li>Impersonate any person or entity</li>
                  <li>Transmit malware or interfere with the Service's operation</li>
                </ul>
                <p>
                  Violation of these terms may result in immediate account suspension or
                  termination without refund.
                </p>
              </section>

              <section id="compliance-obligations" className="mb-12">
                <h2>Compliance Obligations</h2>
                <p>
                  Weeber provides consent management infrastructure, but you remain responsible
                  for ensuring that:
                </p>
                <ul>
                  <li>You have obtained proper consent before importing contacts into the platform</li>
                  <li>Your consent records are accurate and up to date</li>
                  <li>Your calling campaigns comply with applicable regulations including TCPA, TSR, and state-level telemarketing laws</li>
                  <li>Your agents' scripts do not make false or misleading claims</li>
                </ul>
                <p>
                  Weeber will block outbound calls to numbers that lack consent records in our
                  system. You are responsible for ensuring consent records you provide are valid.
                </p>
              </section>

              <section id="call-recording" className="mb-12">
                <h2>Call Recording</h2>
                <p>
                  All calls made through the Service are recorded and transcribed by default.
                  Our AI agents include recording disclosure at the beginning of each call.
                  You are responsible for understanding and complying with applicable recording
                  consent laws in the jurisdictions where calls are made.
                </p>
                <p>
                  Recordings belong to the customer who initiated the call and are subject to
                  the data retention settings configured in your account.
                </p>
              </section>

              <section id="billing" className="mb-12">
                <h2>Billing & Payment</h2>
                <p>
                  The Service is offered on a subscription basis with included minutes. Usage
                  beyond included minutes is billed per-second at the overage rate specified
                  in your plan. All fees are non-refundable except as required by law.
                </p>
                <p>
                  We reserve the right to change pricing with 30 days notice. Price changes
                  take effect at the start of your next billing cycle. If you disagree with
                  a price change, you may cancel your subscription before the new price takes
                  effect.
                </p>
              </section>

              <section id="intellectual-property" className="mb-12">
                <h2>Intellectual Property</h2>
                <p>
                  The Service, including all software, AI models, algorithms, and documentation,
                  is owned by Weeber and protected by intellectual property laws. Your subscription
                  grants you a limited, non-exclusive, non-transferable license to use the Service
                  for its intended purpose.
                </p>
                <p>
                  You retain ownership of your data, including contact lists, custom agent
                  configurations, and call recordings. You grant us a limited license to process
                  this data as necessary to provide the Service.
                </p>
              </section>

              <section id="limitation-of-liability" className="mb-12">
                <h2>Limitation of Liability</h2>
                <p>
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, WEEBER SHALL NOT BE LIABLE FOR ANY
                  INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING
                  BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES.
                </p>
                <p>
                  Our total liability for any claims arising under these Terms shall not exceed
                  the amount you paid us in the 12 months preceding the claim. This limitation
                  applies regardless of the theory of liability.
                </p>
                <p>
                  Weeber is not liable for TCPA violations, fines, or lawsuits arising from
                  your use of the Service if such violations result from inaccurate consent
                  records you provided or from use of the Service in violation of these Terms.
                </p>
              </section>

              <section id="termination" className="mb-12">
                <h2>Termination</h2>
                <p>
                  You may terminate your account at any time through the account settings.
                  Upon termination, your access to the Service will end immediately. We will
                  retain your data for 30 days to allow for data export, after which it will
                  be permanently deleted (except consent records, which are retained for
                  regulatory compliance).
                </p>
                <p>
                  We may terminate or suspend your account immediately if you violate these
                  Terms, fail to pay fees, or if we are required to do so by law.
                </p>
              </section>

              <section id="governing-law" className="mb-12">
                <h2>Governing Law</h2>
                <p>
                  These Terms shall be governed by and construed in accordance with the laws
                  of the State of Delaware, without regard to its conflict of laws principles.
                  Any disputes arising from these Terms shall be resolved in the state or
                  federal courts located in Delaware.
                </p>
                <p>
                  If any provision of these Terms is found to be unenforceable, the remaining
                  provisions will continue in full force and effect.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .legal-prose h2 {
          font-size: 1.25rem;
          font-weight: 600;
          color: #111;
          margin-bottom: 0.75rem;
        }
        .legal-prose h3 {
          font-size: 0.95rem;
          font-weight: 600;
          color: #111;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
        }
        .legal-prose p {
          font-size: 0.9rem;
          line-height: 1.75;
          color: #555;
          margin-bottom: 0.75rem;
        }
        .legal-prose ul {
          margin: 0.75rem 0;
          padding-left: 1.25rem;
          list-style-type: disc;
        }
        .legal-prose ul li {
          font-size: 0.9rem;
          line-height: 1.75;
          color: #555;
          margin-bottom: 0.25rem;
        }
      `}</style>
      </main>

      <MarketingFooter />
    </div>
  );
}
