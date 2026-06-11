import { Link } from "react-router-dom";
import { FOOTER_COLUMNS, SITE } from "../../config/marketing";

export function MarketingFooter() {
  return (
    <footer className="bg-[#111] text-white">
      <div className="max-w-[1200px] mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          <div className="col-span-2 md:col-span-1">
            <div className="font-semibold tracking-tight text-lg">{SITE.name}</div>
            <p className="mt-3 text-sm text-[#999] leading-relaxed max-w-[240px]">
              {SITE.description}
            </p>
          </div>
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <div className="text-xs font-medium tracking-widest uppercase text-[#666] mb-4">
                {col.title}
              </div>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="text-sm text-[#999] hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-16 pt-8 border-t border-[#222] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="text-xs text-[#666]">
            {new Date().getFullYear()} {SITE.name}. All rights reserved.
          </div>
          <div className="text-xs text-[#666]">{SITE.tagline}</div>
        </div>
      </div>
    </footer>
  );
}
