import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { isMarketingDomain, isAppDomain, appUrl, marketingUrl } from "../lib/hostname";
import { identifyUser, resetUser } from "../lib/posthog";

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [status, setStatus] = useState<"loading" | "in" | "out">("loading");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setStatus(data.session ? "in" : "out");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      if (session) {
        identifyUser(session.user.id, { email: session.user.email });
      } else {
        resetUser();
      }
      setStatus(session ? "in" : "out");
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="h-full flex items-center justify-center text-sm text-text-muted">
        Loading...
      </div>
    );
  }
  if (status === "out") {
    if (isAppDomain) {
      window.location.href = marketingUrl("/login");
      return null;
    }
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}

export function PublicOnly({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "in" | "out">("loading");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session && isMarketingDomain) {
        const at = data.session.access_token;
        const rt = data.session.refresh_token;
        window.location.href = `${appUrl("/auth/bridge?redirect=/dashboard")}#access_token=${at}&refresh_token=${rt}`;
        return;
      }
      setStatus(data.session ? "in" : "out");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      if (session && isMarketingDomain) {
        const at = session.access_token;
        const rt = session.refresh_token;
        window.location.href = `${appUrl("/auth/bridge?redirect=/dashboard")}#access_token=${at}&refresh_token=${rt}`;
        return;
      }
      setStatus(session ? "in" : "out");
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="h-full flex items-center justify-center text-sm text-text-muted">
        Loading...
      </div>
    );
  }
  if (status === "in") {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
