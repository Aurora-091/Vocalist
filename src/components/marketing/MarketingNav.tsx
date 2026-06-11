import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { NAV_LINKS, SITE } from "../../config/marketing";

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
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-200 ${
        scrolled ? "bg-[#FAFAF8] border-b border-[#D9D5CE]" : "bg-transparent"
      }`}
    >
      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="font-semibold tracking-tight text-lg text-[#111]">
          {SITE.name}
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="text-sm text-[#555] hover:text-[#111] transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <Link to="/login" className="text-sm text-[#555] hover:text-[#111] transition-colors">
            Sign in
          </Link>
          <Link
            to="/signup"
            className="inline-flex items-center h-9 px-5 bg-[#111] text-white text-sm font-medium rounded-none hover:bg-[#222] transition-colors"
          >
            Start free
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-[#111]"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-[#FAFAF8] border-b border-[#D9D5CE] px-6 pb-6">
          <nav className="flex flex-col gap-4 mb-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="text-sm text-[#555] hover:text-[#111]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col gap-3">
            <Link to="/login" className="text-sm text-[#555]">
              Sign in
            </Link>
            <Link
              to="/signup"
              className="inline-flex items-center justify-center h-10 px-5 bg-[#111] text-white text-sm font-medium rounded-none"
            >
              Start free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
