import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { FOOTER_COLUMNS, SITE } from "../../config/marketing";
import { WeeberLogo } from "../WeeberLogo";

export function MarketingFooter() {
  return (
    <footer className="bg-[#000000] text-white">
      <div className="max-w-[1200px] mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10">
          <div className="col-span-2 md:col-span-2">
            <WeeberLogo size="md" inverted />
            <p className="mt-3 text-sm text-slate-400 leading-relaxed max-w-[240px]">
              {SITE.description}
            </p>
          </div>
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <div className="text-xs font-medium tracking-widest uppercase text-slate-500 mb-4">
                {col.title}
              </div>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    {link.href.startsWith("http") ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-slate-400 hover:text-white transition-colors"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        to={link.href}
                        className="text-sm text-slate-400 hover:text-white transition-colors"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-16 pt-8 border-t border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            {new Date().getFullYear()} {SITE.name}. All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-white/10 text-[10px] font-medium text-slate-400 uppercase tracking-wide">
              <ShieldCheck className="w-3 h-3" />
              SOC 2 Type II Pending
            </div>
            <div className="text-xs text-slate-500">{SITE.tagline}</div>
          </div>
        </div>
      </div>
    </footer>
  );
}
