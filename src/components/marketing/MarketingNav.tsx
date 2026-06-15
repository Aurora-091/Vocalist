import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { NAV_LINKS } from "../../config/marketing";
import { WeeberLogo } from "../WeeberLogo";

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 10);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled
          ? "bg-[#FCFCFB]/86 backdrop-blur-[10px] border-b border-[#E6E5E2]"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="max-w-[1100px] mx-auto px-6 h-[66px] flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <WeeberLogo size="md" />
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="text-[15px] text-[#67676C] hover:text-[#0B0B0C] transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <a
            href="#faq"
            className="text-[15px] text-[#67676C] hover:text-[#0B0B0C] transition-colors"
          >
            Help
          </a>
          <a
            href="#waitlist"
            className="text-[15px] font-semibold text-[#0B0B0C] border border-[#E6E5E2] rounded-[11px] px-4 py-2 hover:bg-[#F3F2EF] transition-colors btn-press"
          >
            Join waitlist
          </a>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-[#0B0B0C]"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-[#FCFCFB] border-b border-[#E6E5E2] px-6 pb-6">
          <nav className="flex flex-col gap-4 mb-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="text-sm text-[#67676C] hover:text-[#0B0B0C]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col gap-3">
            <a
              href="#faq"
              className="text-sm text-[#67676C] hover:text-[#0B0B0C]"
            >
              Help
            </a>
            <a
              href="#waitlist"
              className="text-sm font-semibold text-center bg-[#0B0B0C] text-white rounded-[11px] px-4 py-3"
            >
              Join waitlist
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
