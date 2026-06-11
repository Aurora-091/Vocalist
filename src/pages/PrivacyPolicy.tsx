import { useState, useEffect, useRef } from "react";
import { MarketingNav } from "../components/marketing/MarketingNav";
import { MarketingFooter } from "../components/marketing/MarketingFooter";

const SECTIONS = [
  { id: "introduction", title: "Introduction" },
  { id: "information-we-collect", title: "Information We Collect" },
  { id: "how-we-use-information", title: "How We Use Information" },
  { id: "call-recording-and-transcription", title: "Call Recording & Transcription" },
  { id: "consent-and-compliance", title: "Consent & Compliance" },
  { id: "data-sharing", title: "Data Sharing" },
  { id: "data-retention", title: "Data Retention" },
  { id: "security", title: "Security" },
  { id: "your-rights", title: "Your Rights" },
  { id: "changes", title: "Changes to This Policy" },
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

export default function PrivacyPolicy() {
  const activeId = useTocActive(SECTIONS.map((s) => s.id));

  return (
    <div className="marketing min-h-full bg-[#F8F9FB]">
      <MarketingNav />

      <div className="pt-32 pb-20 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-xs font-medium tracking-widest uppercase text-[#888] mb-4">
            Legal
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#111]">
            Privacy Policy
          </h1>
          <p className="mt-4 text-sm text-[#888]">Last updated: June 1, 2026</p>
        </div>
      </div>

      <div className="border-t border-[#D9D5CE]">
        <div className="max-w-[1200px] mx-auto px-6 py-16">
          <div className="grid md:grid-cols-[220px_1fr] gap-12">
            <nav className="hidden md:block sticky top-24 self-start">
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
              <section id="introduction" className="mb-12">
                <h2>Introduction</h2>
                <p>
                  Aurora Voice AI ("Aurora," "we," "us," or "our") is committed to protecting
                  your privacy. This Privacy Policy explains how we collect, use, disclose,
                  and safeguard your information when you use our voice AI platform and services.
                </p>
                <p>
                  This policy applies to all users of our platform, including business customers
                  who deploy Aurora agents and the end consumers who interact with those agents
                  via phone calls.
                </p>
              </section>

              <section id="information-we-collect" className="mb-12">
                <h2>Information We Collect</h2>
                <p>We collect information in the following categories:</p>
                <h3>Account Information</h3>
                <p>
                  When you create an account, we collect your name, email address, organization
                  name, billing information, and phone numbers associated with your account.
                </p>
                <h3>Call Data</h3>
                <p>
                  When calls are placed through our platform, we collect call metadata (duration,
                  timestamps, phone numbers), audio recordings, transcriptions, and AI-generated
                  summaries and classifications.
                </p>
                <h3>Consent Records</h3>
                <p>
                  We maintain detailed records of consent status for every phone number in our
                  system, including the type of consent, when it was obtained, and the source.
                </p>
              </section>

              <section id="how-we-use-information" className="mb-12">
                <h2>How We Use Information</h2>
                <p>We use collected information to:</p>
                <ul>
                  <li>Provide, maintain, and improve our voice AI services</li>
                  <li>Process calls and generate transcriptions</li>
                  <li>Enforce compliance with TCPA and state-level telemarketing regulations</li>
                  <li>Maintain audit trails for regulatory purposes</li>
                  <li>Generate analytics and usage reports for our customers</li>
                  <li>Bill for services and process payments</li>
                  <li>Communicate with you about your account and our services</li>
                </ul>
              </section>

              <section id="call-recording-and-transcription" className="mb-12">
                <h2>Call Recording & Transcription</h2>
                <p>
                  All calls made through Aurora are recorded and transcribed. Our AI agents
                  disclose recording at the beginning of every call as required by applicable
                  two-party consent laws. Recordings are used for:
                </p>
                <ul>
                  <li>Quality assurance and service improvement</li>
                  <li>Compliance verification and audit purposes</li>
                  <li>Dispute resolution</li>
                  <li>Training and improving our AI models (only with explicit customer consent)</li>
                </ul>
                <p>
                  Customers can configure retention periods for recordings. Default retention
                  is 90 days, after which recordings are automatically deleted.
                </p>
              </section>

              <section id="consent-and-compliance" className="mb-12">
                <h2>Consent & Compliance</h2>
                <p>
                  Aurora's consent management system is a core part of our infrastructure.
                  We maintain an append-only consent ledger that records:
                </p>
                <ul>
                  <li>The type of consent obtained (express, express written, implied)</li>
                  <li>The date and method of consent collection</li>
                  <li>The scope of consent (what types of calls are permitted)</li>
                  <li>Any revocations or modifications to consent</li>
                </ul>
                <p>
                  Our system will not initiate an outbound call to any number that lacks
                  valid consent. This check is performed at the infrastructure level and
                  cannot be bypassed by application-level configuration.
                </p>
              </section>

              <section id="data-sharing" className="mb-12">
                <h2>Data Sharing</h2>
                <p>We do not sell personal information. We share data only in these circumstances:</p>
                <ul>
                  <li>With our customers (the businesses who deploy Aurora agents) — they receive call data, transcripts, and outcomes for calls made on their behalf</li>
                  <li>With service providers who help us operate our platform (cloud hosting, payment processing)</li>
                  <li>When required by law, regulation, or legal process</li>
                  <li>To protect the rights, property, or safety of Aurora, our customers, or others</li>
                </ul>
              </section>

              <section id="data-retention" className="mb-12">
                <h2>Data Retention</h2>
                <p>
                  We retain different types of data for different periods:
                </p>
                <ul>
                  <li>Account information: retained while your account is active, deleted within 30 days of account closure</li>
                  <li>Call recordings: configurable, default 90 days</li>
                  <li>Transcripts: configurable, default 1 year</li>
                  <li>Consent records: retained for 5 years after last activity (regulatory requirement)</li>
                  <li>Billing records: retained for 7 years (tax requirement)</li>
                </ul>
              </section>

              <section id="security" className="mb-12">
                <h2>Security</h2>
                <p>
                  We implement industry-standard security measures including encryption at rest
                  and in transit, access controls, regular security audits, and SOC 2 Type II
                  compliance (in progress). All call data is encrypted using AES-256 and stored
                  in geographically redundant data centers within the United States.
                </p>
              </section>

              <section id="your-rights" className="mb-12">
                <h2>Your Rights</h2>
                <p>Depending on your jurisdiction, you may have the right to:</p>
                <ul>
                  <li>Access the personal information we hold about you</li>
                  <li>Request correction of inaccurate information</li>
                  <li>Request deletion of your information</li>
                  <li>Object to or restrict processing of your information</li>
                  <li>Data portability</li>
                  <li>Opt out of automated decision-making</li>
                </ul>
                <p>
                  To exercise these rights, contact us at privacy@aurora.dev. We will respond
                  within 30 days.
                </p>
              </section>

              <section id="changes" className="mb-12">
                <h2>Changes to This Policy</h2>
                <p>
                  We may update this Privacy Policy from time to time. We will notify you of
                  material changes by email and by posting the updated policy on our website
                  with a new "Last Updated" date. Your continued use of our services after
                  such notification constitutes acceptance of the updated policy.
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

      <MarketingFooter />
    </div>
  );
}
